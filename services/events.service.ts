import type { Prisma } from "../generated/prisma/client.js";
import { EventCategory } from "../generated/prisma/enums.js";
import { uploadImage } from "../lib/cloudinary.js";
import { prisma } from "../lib/prisma.js";
import type { PaginationQueryParams } from "../types/pagination.js";
import { ApiError } from "../utils/api-error.js";
import { nowInJakarta } from "../utils/date.js";
import { slugify } from "../utils/slug.js";
import { type CreateEventSchema } from "../validators/event.validator.js";
import { nanoid } from "nanoid";

interface GetEventsQuery extends PaginationQueryParams {
  category: string;
}

const normalizeCategory = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const getEventsService = async (query: GetEventsQuery) => {
  const { page, take, sortOrder, sortBy, search, category } = query;

  const normalizedCategory = normalizeCategory(category);
  const hasCategoryFilter = Boolean(category) && normalizedCategory !== "ALL";

  const trimmedSearch = search?.trim();

  const whereClause: Prisma.EventWhereInput = {

    endDate: { gte: nowInJakarta() },
    ...(hasCategoryFilter && {
      category: normalizedCategory as EventCategory,
    }),
    ...(trimmedSearch && {
      OR: [
        { eventName: { contains: trimmedSearch, mode: "insensitive" } },
        { location: { contains: trimmedSearch, mode: "insensitive" } },
        { venue: { contains: trimmedSearch, mode: "insensitive" } },
      ],
    }),
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
    },
  };
};

export const getEventBySlugService = async (slug: string) => {
  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      organizer: {
        select: {
          id: true,
          organizerName: true,
          organizerLogo: true,
          rating: true,
          totalReviews: true,
        },
      },
    },
  });
  if (!event) {
    throw new ApiError("Event not found!", 404);
  }
  return event;
};

export const createEventService = async (
  body: CreateEventSchema,
  userId: number,
  thumbnail: Express.Multer.File,
) => {
  
  const organizer = await prisma.organizer.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!organizer) {
    throw new ApiError("Only organizers can create events", 403);
  }

  const existingEvent = await prisma.event.findFirst({
    where: { eventName: body.eventName, organizerId: organizer.id },
  });
  if (existingEvent) {
    throw new ApiError("You already have an event with this name", 400);
  }

  const slug = `${slugify(body.eventName)}-${nanoid()}`;
  const { secure_url } = await uploadImage(thumbnail);

  const event = await prisma.event.create({
    data: {
      ...body,
      slug,
      organizerId: organizer.id,
      availableSeats: body.totalSeats,
      thumbnail: secure_url,
    },
  });

  return { message: "create event success", data: event };
};
