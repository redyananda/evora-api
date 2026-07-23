import type { Prisma } from "../generated/prisma/client.js";
import {
  EventCategory,
  TransactionStatus,
} from "../generated/prisma/enums.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { addCalendarMonths } from "../utils/date.js";
import { sendTransactionStatusEmail } from "./email.service.js";

const allowedCategories = new Set<string>(Object.values(EventCategory));
const allowedStatuses = new Set<string>(Object.values(TransactionStatus));

type StatisticPeriod = "day" | "month" | "year";

export interface OrganizerListQuery {
  page: number;
  take: number;
  search?: string;
  status?: string;
  eventId?: number;
}

export interface EventPayload {
  eventName?: string;
  description?: string;
  category?: string;
  price?: number;
  venue?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  totalSeats?: number;
  thumbnail?: string | null;
}

const getOrganizer = async (userId: number) => {
  const organizer = await prisma.organizer.findUnique({ where: { userId } });
  if (!organizer) throw new ApiError("Organizer profile not found", 404);
  return organizer;
};

const parseDate = (value: string | undefined, field: string) => {
  if (!value) throw new ApiError(`${field} is required`, 400);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(`${field} must be a valid date`, 400);
  }
  return parsed;
};

const validateEventPayload = (payload: EventPayload) => {
  if (payload.eventName !== undefined) {
    if (!payload.eventName?.trim()) throw new ApiError("Event name is required", 400);
  }
  if (payload.description !== undefined) {
    if (!payload.description?.trim()) throw new ApiError("Description is required", 400);
  }
  if (payload.category !== undefined) {
    if (!payload.category || !allowedCategories.has(payload.category)) {
      throw new ApiError("Invalid event category", 400);
    }
  }
  if (payload.venue !== undefined) {
    if (!payload.venue?.trim()) throw new ApiError("Venue is required", 400);
  }
  if (payload.location !== undefined) {
    if (!payload.location?.trim()) throw new ApiError("Location is required", 400);
  }
  if (payload.price !== undefined) {
    if (!Number.isInteger(payload.price) || payload.price! < 0) {
      throw new ApiError("Price must be a non-negative integer", 400);
    }
  }
  if (payload.totalSeats !== undefined) {
    if (!Number.isInteger(payload.totalSeats) || payload.totalSeats! < 1) {
      throw new ApiError("Total seats must be a positive integer", 400);
    }
  }
};

const parseAnchor = (value?: string) => {
  const anchor = value ? new Date(`${value}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(anchor.getTime())) throw new ApiError("Invalid statistic date", 400);
  return anchor;
};

const getPeriodConfig = (period: StatisticPeriod, date?: string) => {
  const anchor = parseAnchor(date);
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const day = anchor.getUTCDate();

  if (period === "day") {
    return {
      start: new Date(Date.UTC(year, month, day)),
      end: new Date(Date.UTC(year, month, day + 1)),
      bucketCount: 24,
      bucketIndex: (value: Date) => value.getUTCHours(),
      bucketLabel: (index: number) => `${String(index).padStart(2, "0")}:00`,
    };
  }

  if (period === "month") {
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return {
      start: new Date(Date.UTC(year, month, 1)),
      end: new Date(Date.UTC(year, month + 1, 1)),
      bucketCount: daysInMonth,
      bucketIndex: (value: Date) => value.getUTCDate() - 1,
      bucketLabel: (index: number) => String(index + 1),
    };
  }

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1)),
    bucketCount: 12,
    bucketIndex: (value: Date) => value.getUTCMonth(),
    bucketLabel: (index: number) => monthNames[index] ?? "",
  };
};

export const getPublicOrganizerProfileService = async (organizerId: number) => {
  const organizer = await prisma.organizer.findUnique({
    where: { id: organizerId },
    select: {
      id: true,
      organizerName: true,
      organizerDescription: true,
      organizerLogo: true,
      createdAt: true,
      _count: { select: { events: true } },
    },
  });
  if (!organizer) throw new ApiError("Organizer not found", 404);

  const reviews = await prisma.review.findMany({
    where: { transaction: { event: { organizerId } } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true, profilePicture: true } },
      transaction: { select: { event: { select: { eventName: true } } } },
    },
  });

  const totalReviews = reviews.length;
  const rating =
    totalReviews === 0
      ? 0
      : Math.round(
          (reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews) *
            10
        ) / 10;

  const { _count, ...profile } = organizer;
  return {
    ...profile,
    rating,
    totalReviews,
    totalEvents: _count.events,
    reviews: reviews.map((review) => ({
      id: review.id,
      name: `${review.user.firstName} ${review.user.lastName}`.trim(),
      avatar: review.user.profilePicture,
      rating: review.rating,
      comment: review.comment,
      eventName: review.transaction.event.eventName,
      createdAt: review.createdAt,
    })),
  };
};

export const getOrganizerDashboardService = async (
  userId: number,
  periodInput?: string,
  date?: string
) => {
  const organizer = await getOrganizer(userId);
  const period: StatisticPeriod =
    periodInput === "day" || periodInput === "year" ? periodInput : "month";
  const config = getPeriodConfig(period, date);
  const now = new Date();

  const [totalEvents, upcomingEvents, acceptedTransactions, statusGroups] =
    await Promise.all([
      prisma.event.count({ where: { organizerId: organizer.id } }),
      prisma.event.count({
        where: { organizerId: organizer.id, endDate: { gte: now } },
      }),
      prisma.transaction.findMany({
        where: {
          status: TransactionStatus.DONE,
          event: { organizerId: organizer.id },
          updatedAt: { gte: config.start, lt: config.end },
        },
        select: {
          quantity: true,
          finalPrice: true,
          updatedAt: true,
          eventId: true,
          event: { select: { eventName: true } },
        },
      }),
      prisma.transaction.groupBy({
        by: ["status"],
        where: {
          event: { organizerId: organizer.id },
          createdAt: { gte: config.start, lt: config.end },
        },
        _count: { _all: true },
      }),
    ]);

  const series = Array.from({ length: config.bucketCount }, (_, index) => ({
    label: config.bucketLabel(index),
    revenue: 0,
    tickets: 0,
    transactions: 0,
  }));
  const topEventMap = new Map<
    number,
    { eventId: number; eventName: string; revenue: number; tickets: number }
  >();

  for (const transaction of acceptedTransactions) {
    const bucket = series[config.bucketIndex(transaction.updatedAt)];
    if (bucket) {
      bucket.revenue += transaction.finalPrice;
      bucket.tickets += transaction.quantity;
      bucket.transactions += 1;
    }
    const event = topEventMap.get(transaction.eventId) ?? {
      eventId: transaction.eventId,
      eventName: transaction.event.eventName,
      revenue: 0,
      tickets: 0,
    };
    event.revenue += transaction.finalPrice;
    event.tickets += transaction.quantity;
    topEventMap.set(transaction.eventId, event);
  }

  const statusCounts = Object.fromEntries(
    Object.values(TransactionStatus).map((status) => [status, 0])
  ) as Record<string, number>;
  for (const group of statusGroups) statusCounts[group.status] = group._count._all;

  return {
    period,
    range: { start: config.start, end: config.end },
    summary: {
      totalEvents,
      upcomingEvents,
      revenue: acceptedTransactions.reduce((sum, item) => sum + item.finalPrice, 0),
      ticketsSold: acceptedTransactions.reduce((sum, item) => sum + item.quantity, 0),
      acceptedTransactions: acceptedTransactions.length,
      pendingTransactions:
        statusCounts[TransactionStatus.WAITING_FOR_ADMIN_CONFIRMATION] ?? 0,
    },
    statusCounts,
    series,
    topEvents: [...topEventMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
  };
};

export const getOrganizerEventsService = async (
  userId: number,
  query: OrganizerListQuery
) => {
  const organizer = await getOrganizer(userId);
  const where: Prisma.EventWhereInput = {
    organizerId: organizer.id,
    ...(query.search
      ? {
          OR: [
            { eventName: { contains: query.search, mode: "insensitive" } },
            { location: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { startDate: "desc" },
      skip: (query.page - 1) * query.take,
      take: query.take,
      include: { _count: { select: { transactions: true } } },
    }),
    prisma.event.count({ where }),
  ]);
  const eventIds = events.map((event) => event.id);
  const sales = eventIds.length
    ? await prisma.transaction.groupBy({
        by: ["eventId"],
        where: { eventId: { in: eventIds }, status: TransactionStatus.DONE },
        _sum: { quantity: true, finalPrice: true },
      })
    : [];
  const salesMap = new Map(sales.map((item) => [item.eventId, item._sum]));

  return {
    data: events.map(({ _count, ...event }) => ({
      ...event,
      transactionCount: _count.transactions,
      ticketsSold: salesMap.get(event.id)?.quantity ?? 0,
      revenue: salesMap.get(event.id)?.finalPrice ?? 0,
    })),
    meta: { page: query.page, take: query.take, total },
  };
};

export const updateOrganizerEventService = async (
  userId: number,
  eventId: number,
  payload: EventPayload
) => {
  validateEventPayload(payload);
  const organizer = await getOrganizer(userId);
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerId: organizer.id },
  });
  if (!event) throw new ApiError("Event not found", 404);

  const startDate = payload.startDate ? parseDate(payload.startDate, "Start date") : event.startDate;
  const endDate = payload.endDate ? parseDate(payload.endDate, "End date") : event.endDate;
  if (endDate <= startDate) throw new ApiError("End date must be after start date", 400);

  const soldSeats = event.totalSeats - event.availableSeats;
  if (payload.totalSeats !== undefined && payload.totalSeats < soldSeats) {
    throw new ApiError(`Total seats cannot be lower than ${soldSeats} sold seats`, 400);
  }

  return prisma.event.update({
    where: { id: event.id },
    data: {
      ...(payload.eventName !== undefined && { eventName: payload.eventName.trim() }),
      ...(payload.description !== undefined && { description: payload.description.trim() }),
      ...(payload.category !== undefined && { category: payload.category as EventCategory }),
      ...(payload.price !== undefined && { price: payload.price }),
      ...(payload.venue !== undefined && { venue: payload.venue.trim() }),
      ...(payload.location !== undefined && { location: payload.location.trim() }),
      ...(payload.startDate !== undefined && { startDate }),
      ...(payload.endDate !== undefined && { endDate }),
      ...(payload.totalSeats !== undefined && {
        totalSeats: payload.totalSeats,
        availableSeats: payload.totalSeats - soldSeats,
      }),
      ...(payload.thumbnail !== undefined && {
        thumbnail: payload.thumbnail?.trim() || null,
      }),
    },
  });
};

export const deleteOrganizerEventService = async (userId: number, eventId: number) => {
  const organizer = await getOrganizer(userId);
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerId: organizer.id },
    include: { _count: { select: { transactions: true } } },
  });
  if (!event) throw new ApiError("Event not found", 404);
  if (event._count.transactions > 0) {
    throw new ApiError("Events with transactions cannot be deleted", 409);
  }
  await prisma.event.delete({ where: { id: event.id } });
};

export const getOrganizerTransactionsService = async (
  userId: number,
  query: OrganizerListQuery
) => {
  const organizer = await getOrganizer(userId);
  if (query.status && !allowedStatuses.has(query.status)) {
    throw new ApiError("Invalid transaction status", 400);
  }
  const where: Prisma.TransactionWhereInput = {
    event: { organizerId: organizer.id },
    ...(query.status && { status: query.status as TransactionStatus }),
    ...(query.eventId && { eventId: query.eventId }),
    ...(query.search && {
      OR: [
        { user: { firstName: { contains: query.search, mode: "insensitive" } } },
        { user: { lastName: { contains: query.search, mode: "insensitive" } } },
        { user: { email: { contains: query.search, mode: "insensitive" } } },
        { event: { eventName: { contains: query.search, mode: "insensitive" } } },
      ],
    }),
  };
  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.take,
      take: query.take,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        event: { select: { id: true, eventName: true, thumbnail: true } },
        voucher: { select: { code: true, discount: true } },
        coupon: { select: { code: true, discount: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);
  return { data: transactions, meta: { page: query.page, take: query.take, total } };
};

export const updateTransactionStatusService = async (
  userId: number,
  transactionId: number,
  action: "ACCEPT" | "REJECT"
) => {
  const organizer = await getOrganizer(userId);
  const nextStatus = action === "ACCEPT" ? TransactionStatus.DONE : TransactionStatus.REJECTED;

  const updated = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findFirst({
      where: { id: transactionId, event: { organizerId: organizer.id } },
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
        event: { select: { id: true, eventName: true, totalSeats: true, availableSeats: true } },
        voucher: { select: { id: true, total: true, availableVoucher: true } },
      },
    });
    if (!transaction) throw new ApiError("Transaction not found", 404);
    if (transaction.status !== TransactionStatus.WAITING_FOR_ADMIN_CONFIRMATION) {
      throw new ApiError("Only transactions awaiting confirmation can be processed", 409);
    }

    const changed = await tx.transaction.updateMany({
      where: {
        id: transaction.id,
        status: TransactionStatus.WAITING_FOR_ADMIN_CONFIRMATION,
      },
      data: { status: nextStatus },
    });
    if (changed.count !== 1) throw new ApiError("Transaction was already processed", 409);

    if (action === "REJECT") {
      await tx.event.update({
        where: { id: transaction.event.id },
        data: {
          availableSeats: Math.min(
            transaction.event.totalSeats,
            transaction.event.availableSeats + transaction.quantity
          ),
        },
      });

      if (transaction.voucher) {
        await tx.voucher.update({
          where: { id: transaction.voucher.id },
          data: {
            availableVoucher: Math.min(
              transaction.voucher.total,
              transaction.voucher.availableVoucher + 1
            ),
          },
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
    }

    return {
      id: transaction.id,
      status: nextStatus,
      user: transaction.user,
      eventName: transaction.event.eventName,
      quantity: transaction.quantity,
      finalPrice: transaction.finalPrice,
    };
  }, { isolationLevel: "Serializable" });

  let emailDelivered = false;
  try {
    emailDelivered = await sendTransactionStatusEmail({
      recipientEmail: updated.user.email,
      customerName: `${updated.user.firstName} ${updated.user.lastName}`.trim(),
      eventName: updated.eventName,
      transactionId: updated.id,
      status: updated.status,
      quantity: updated.quantity,
      finalPrice: updated.finalPrice,
    });
  } catch (error) {
    console.error(`[Email failed] Transaction #${updated.id}`, error);
  }

  return { transaction: { id: updated.id, status: updated.status }, emailDelivered };
};

export const getEventParticipantsService = async (userId: number, eventId: number) => {
  const organizer = await getOrganizer(userId);
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerId: organizer.id },
    select: { id: true, eventName: true },
  });
  if (!event) throw new ApiError("Event not found", 404);

  const participants = await prisma.transaction.findMany({
    where: { eventId: event.id, status: TransactionStatus.DONE },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      quantity: true,
      finalPrice: true,
      paidAt: true,
      updatedAt: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  return {
    event,
    summary: {
      participantCount: new Set(participants.map((item) => item.user.id)).size,
      tickets: participants.reduce((sum, item) => sum + item.quantity, 0),
      revenue: participants.reduce((sum, item) => sum + item.finalPrice, 0),
    },
    data: participants.map((item) => ({
      transactionId: item.id,
      name: `${item.user.firstName} ${item.user.lastName}`.trim(),
      email: item.user.email,
      quantity: item.quantity,
      totalPaid: item.finalPrice,
      paidAt: item.paidAt ?? item.updatedAt,
    })),
  };
};
