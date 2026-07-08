import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import type { PaginationQueryParams } from "../types/pagination.js";

export const getEventsService = async (query: PaginationQueryParams) => {
  const { page, take, sortOrder, sortBy, search } = query;
  const whereClause: Prisma.EventWhereInput = {
    startDate: { gte: new Date() },
  };

  const events = await prisma.event.findMany({
    where: whereClause,
    skip: (page - 1) * take,
    take: take,
    orderBy: { [sortBy]: sortOrder },
    include: { organizer: { select: { organizerName: true } } },
  });

  const total = await prisma.event.count({ where: whereClause });

  return {
    data: events,
    meta: {
        page: page,
        take: take,
        total: total,
    }
  };
};
