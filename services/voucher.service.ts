import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import type { CreateVoucherSchema } from "../validators/voucher.validator.js";

const getOrganizer = async (userId: number) => {
  const organizer = await prisma.organizer.findUnique({ where: { userId } });
  if (!organizer) throw new ApiError("Organizer profile not found", 404);
  return organizer;
};

export const createVoucherService = async (
  userId: number,
  payload: CreateVoucherSchema
) => {
  const organizer = await getOrganizer(userId);

  const event = await prisma.event.findFirst({
    where: { id: payload.eventId, organizerId: organizer.id },
    select: { id: true },
  });
  if (!event) throw new ApiError("Event not found", 404);

  if (payload.endDate <= new Date()) {
    throw new ApiError("End date must be in the future", 400);
  }

  const existing = await prisma.voucher.findUnique({
    where: { eventId_code: { eventId: payload.eventId, code: payload.code } },
  });
  if (existing) {
    throw new ApiError("A voucher with this code already exists for this event", 409);
  }

  const voucher = await prisma.voucher.create({
    data: {
      eventId: payload.eventId,
      code: payload.code,
      discount: payload.discount,
      total: payload.total,
      availableVoucher: payload.total,
      startDate: payload.startDate,
      endDate: payload.endDate,
    },
  });

  return { message: "Voucher created successfully", data: voucher };
};

export const getOrganizerVouchersService = async (
  userId: number,
  eventId?: number
) => {
  const organizer = await getOrganizer(userId);

  const vouchers = await prisma.voucher.findMany({
    where: {
      event: { organizerId: organizer.id },
      ...(eventId ? { eventId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { event: { select: { id: true, eventName: true } } },
  });

  const now = new Date();
  return {
    data: vouchers.map((voucher) => ({
      ...voucher,
      claimedCount: voucher.total - voucher.availableVoucher,
      isActive:
        voucher.startDate <= now &&
        voucher.endDate >= now &&
        voucher.availableVoucher > 0,
    })),
  };
};

export const deleteVoucherService = async (userId: number, voucherId: number) => {
  const organizer = await getOrganizer(userId);

  const voucher = await prisma.voucher.findFirst({
    where: { id: voucherId, event: { organizerId: organizer.id } },
    include: { _count: { select: { transactions: true } } },
  });
  if (!voucher) throw new ApiError("Voucher not found", 404);
  if (voucher._count.transactions > 0) {
    throw new ApiError("Vouchers that have been used cannot be deleted", 409);
  }

  await prisma.voucher.delete({ where: { id: voucher.id } });
};

export const getEventVouchersService = async (slug: string) => {
  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!event) throw new ApiError("Event not found", 404);

  const now = new Date();
  const vouchers = await prisma.voucher.findMany({
    where: {
      eventId: event.id,
      startDate: { lte: now },
      endDate: { gte: now },
      availableVoucher: { gt: 0 },
    },
    orderBy: { discount: "desc" },
    select: {
      id: true,
      code: true,
      discount: true,
      availableVoucher: true,
      endDate: true,
    },
  });

  return { data: vouchers };
};
