import type { Prisma } from "../generated/prisma/client.js";
import { TransactionStatus } from "../generated/prisma/enums.js";
import { uploadImage } from "../lib/cloudinary.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { addCalendarMonths } from "../utils/date.js";
import { type CreateTransactionSchema } from "../validators/transaction.validator.js";

const TAX_RATE = 0.11;


const PAYMENT_WINDOW_HOURS = 2;
const CONFIRMATION_WINDOW_DAYS = 3;

export const createTransactionService = async (
  userId: number,
  body: CreateTransactionSchema,
) => {
  const { eventId, quantity, voucherCode } = body;

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new ApiError("Event not found", 404);
  }

  if (event.availableSeats < quantity) {
    throw new ApiError(
      `Only ${event.availableSeats} seat(s) left for this event`,
      400,
    );
  }

  let voucher: { id: number; discount: number } | null = null;
  if (voucherCode) {
    const now = new Date();
    const found = await prisma.voucher.findUnique({
      where: { eventId_code: { eventId, code: voucherCode } },
    });

    if (
      !found ||
      found.availableVoucher <= 0 ||
      now < found.startDate ||
      now > found.endDate
    ) {
      throw new ApiError("Voucher is invalid or no longer available", 400);
    }
    voucher = { id: found.id, discount: found.discount };
  }


  const subtotal = event.price * quantity;
  const discount = voucher ? Math.min(voucher.discount, subtotal) : 0;
  const tax = Math.round(subtotal * TAX_RATE);
  const finalPrice = subtotal - discount + tax;


  const isFree = finalPrice <= 0;

  const paymentDeadline = new Date(
    Date.now() + PAYMENT_WINDOW_HOURS * 60 * 60 * 1000,
  );


  const transaction = await prisma.$transaction(async (tx) => {
    const seatUpdate = await tx.event.updateMany({
      where: { id: eventId, availableSeats: { gte: quantity } },
      data: { availableSeats: { decrement: quantity } },
    });
    if (seatUpdate.count === 0) {
      throw new ApiError("Seats were just taken. Please try again.", 409);
    }

    if (voucher) {
      const voucherUpdate = await tx.voucher.updateMany({
        where: { id: voucher.id, availableVoucher: { gt: 0 } },
        data: { availableVoucher: { decrement: 1 } },
      });
      if (voucherUpdate.count === 0) {
        throw new ApiError("Voucher is no longer available", 400);
      }
    }

    return tx.transaction.create({
      data: {
        userId,
        eventId,
        voucherId: voucher?.id ?? null,
        quantity,
        totalPrice: subtotal,
        finalPrice,
        paymentDeadline,
        ...(isFree
          ? { status: TransactionStatus.DONE, paidAt: new Date() }
          : {}),
      },
    });
  });

  return {
    message: "Order created successfully",
    data: {
      ...transaction,
      breakdown: { subtotal, tax, discount, total: finalPrice },
    },
  };
};

export const getTransactionByIdService = async (
  transactionId: number,
  userId: number,
) => {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      event: {
        select: {
          eventName: true,
          slug: true,
          venue: true,
          location: true,
          startDate: true,
          price: true,
          thumbnail: true,
        },
      },
    },
  });

  if (!transaction || transaction.userId !== userId) {
    throw new ApiError("Order not found", 404);
  }

  return { data: transaction };
};

export const uploadPaymentProofService = async (
  transactionId: number,
  userId: number,
  proof: Express.Multer.File,
) => {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction || transaction.userId !== userId) {
    throw new ApiError("Order not found", 404);
  }

  if (transaction.status !== TransactionStatus.WAITING_FOR_PAYMENT) {
    throw new ApiError(
      "This order is not awaiting payment anymore",
      400,
    );
  }

  if (transaction.paymentDeadline < new Date()) {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.EXPIRED },
    });
    throw new ApiError("Payment window has expired", 400);
  }

  const { secure_url } = await uploadImage(proof);

  const confirmationDeadline = new Date(
    Date.now() + CONFIRMATION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      paymentProof: secure_url,
      paidAt: new Date(),
      status: TransactionStatus.WAITING_FOR_ADMIN_CONFIRMATION,
      confirmationDeadline,
    },
  });

  return { message: "Payment proof uploaded successfully", data: updated };
};

const restoreTransactionResources = async (
  tx: Prisma.TransactionClient,
  transaction: {
    userId: number;
    eventId: number;
    quantity: number;
    voucherId: number | null;
    couponId: number | null;
    pointUsed: number | null;
  },
) => {
  await tx.event.update({
    where: { id: transaction.eventId },
    data: { availableSeats: { increment: transaction.quantity } },
  });

  if (transaction.voucherId) {
    await tx.voucher.update({
      where: { id: transaction.voucherId },
      data: { availableVoucher: { increment: 1 } },
    });
  }

  if (transaction.couponId) {
    const usedCoupon = await tx.userCoupon.findFirst({
      where: {
        userId: transaction.userId,
        couponId: transaction.couponId,
        isUsed: true,
      },
      orderBy: { usedAt: "desc" },
    });
    if (usedCoupon) {
      await tx.userCoupon.update({
        where: { id: usedCoupon.id },
        data: { isUsed: false, usedAt: null },
      });
    }
  }

  if (transaction.pointUsed && transaction.pointUsed > 0) {
    const refundedAt = new Date();
    await tx.point.create({
      data: {
        userId: transaction.userId,
        amount: transaction.pointUsed,
        expiredAt: addCalendarMonths(refundedAt, 3),
        createdAt: refundedAt,
      },
    });
    await tx.user.update({
      where: { id: transaction.userId },
      data: { userPoint: { increment: transaction.pointUsed } },
    });
  }
};

export const sweepStaleTransactionsService = async () => {
  const now = new Date();
  const stale = await prisma.transaction.findMany({
    where: {
      OR: [
        {
          status: TransactionStatus.WAITING_FOR_PAYMENT,
          paymentDeadline: { lt: now },
        },
        {
          status: TransactionStatus.WAITING_FOR_ADMIN_CONFIRMATION,
          confirmationDeadline: { lt: now },
        },
      ],
    },
    select: {
      id: true,
      status: true,
      userId: true,
      eventId: true,
      quantity: true,
      voucherId: true,
      couponId: true,
      pointUsed: true,
    },
  });

  let expired = 0;
  let canceled = 0;

  for (const transaction of stale) {
    const isAwaitingPayment =
      transaction.status === TransactionStatus.WAITING_FOR_PAYMENT;
    const nextStatus = isAwaitingPayment
      ? TransactionStatus.EXPIRED
      : TransactionStatus.CANCELED;
    // Guard on the deadline that actually governs this status, so the
    // conditional update stays consistent with the query above.
    const deadlineGuard = isAwaitingPayment
      ? { paymentDeadline: { lt: new Date() } }
      : { confirmationDeadline: { lt: new Date() } };

    try {
      const changed = await prisma.$transaction(
        async (tx) => {
          const result = await tx.transaction.updateMany({
            where: {
              id: transaction.id,
              status: transaction.status,
              ...deadlineGuard,
            },
            data: { status: nextStatus },
          });
          if (result.count !== 1) return false;

          await restoreTransactionResources(tx, transaction);
          return true;
        },
        { isolationLevel: "Serializable" },
      );

      if (changed) {
        if (nextStatus === TransactionStatus.EXPIRED) expired++;
        else canceled++;
      }
    } catch (error) {
      console.error(`[Sweep failed] Transaction #${transaction.id}`, error);
    }
  }

  return { expired, canceled };
};
