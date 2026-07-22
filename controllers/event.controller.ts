import type { Request, Response } from "express";
import {
  createEventService,
  getEventBySlugService,
  getEventsService,
} from "../services/events.service.js";
import { ApiError } from "../utils/api-error.js";
import { baseQuery } from "../utils/query.js";

export const getEventsController = async (req: Request, res: Response) => {
  const query = {
    ...baseQuery(req),
    category: (req.query.category as string) || "",
  };
  const result = await getEventsService(query);
  res.status(200).send(result);
};

export const getEventBySlugController = async (req: Request, res: Response) => {
  const slug = req.params.slug as string;
  const result = await getEventBySlugService(slug);
  res.status(200).send(result);
};

export const createEventController = async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const thumbnail = files.thumbnail?.[0];
  if (!thumbnail) throw new ApiError("Thumbnail is required", 400);

  const result = await createEventService(req.body, userId, thumbnail);
  res.status(201).send(result);
};
