import { TransactionStatus } from "../generated/prisma/enums.js";
import { uploadImage } from "../lib/cloudinary.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { type CreateTransactionSchema } from "../validators/transaction.validator.js";

const TAX_RATE = 0.11;

const PAYMENT_WINDOW_HOURS = 2;

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

  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      paymentProof: secure_url,
      paidAt: new Date(),
      status: TransactionStatus.WAITING_FOR_ADMIN_CONFIRMATION,
    },
  });

  return { message: "Payment proof uploaded successfully", data: updated };
};
