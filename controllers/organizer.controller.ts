import type { NextFunction, Request, Response } from "express";
import {
  createOrganizerEventService,
  deleteOrganizerEventService,
  getEventParticipantsService,
  getOrganizerDashboardService,
  getOrganizerEventsService,
  getOrganizerTransactionsService,
  updateOrganizerEventService,
  updateTransactionStatusService,
  type EventPayload,
} from "../services/organizer.service.js";
import { ApiError } from "../utils/api-error.js";

const userId = (req: Request) => {
  if (!req.user) throw new ApiError("Unauthenticated", 401);
  return req.user.id;
};

const positiveInt = (value: unknown, fallback?: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    if (fallback !== undefined) return fallback;
    throw new ApiError("Invalid numeric identifier", 400);
  }
  return parsed;
};

const listQuery = (req: Request) => ({
  page: positiveInt(req.query.page, 1),
  take: Math.min(positiveInt(req.query.take, 10), 50),
  ...(typeof req.query.search === "string" && req.query.search.trim()
    ? { search: req.query.search.trim() }
    : {}),
  ...(typeof req.query.status === "string" && req.query.status
    ? { status: req.query.status }
    : {}),
  ...(req.query.eventId ? { eventId: positiveInt(req.query.eventId) } : {}),
});

export const getOrganizerDashboardController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await getOrganizerDashboardService(
      userId(req),
      typeof req.query.period === "string" ? req.query.period : undefined,
      typeof req.query.date === "string" ? req.query.date : undefined
    );
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

export const getOrganizerEventsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json(await getOrganizerEventsService(userId(req), listQuery(req)));
  } catch (error) {
    next(error);
  }
};

export const createOrganizerEventController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await createOrganizerEventService(userId(req), req.body as EventPayload);
    res.status(201).json({ message: "Event created successfully", data });
  } catch (error) {
    next(error);
  }
};

export const updateOrganizerEventController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await updateOrganizerEventService(
      userId(req),
      positiveInt(req.params.eventId),
      req.body as EventPayload
    );
    res.status(200).json({ message: "Event updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const deleteOrganizerEventController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteOrganizerEventService(userId(req), positiveInt(req.params.eventId));
    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const getOrganizerTransactionsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json(await getOrganizerTransactionsService(userId(req), listQuery(req)));
  } catch (error) {
    next(error);
  }
};

export const updateTransactionStatusController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const action = req.body.action;
    if (action !== "ACCEPT" && action !== "REJECT") {
      throw new ApiError("Action must be ACCEPT or REJECT", 400);
    }
    const data = await updateTransactionStatusService(
      userId(req),
      positiveInt(req.params.transactionId),
      action
    );
    res.status(200).json({
      message: `Transaction ${action === "ACCEPT" ? "accepted" : "rejected"} successfully`,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getEventParticipantsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getEventParticipantsService(userId(req), positiveInt(req.params.eventId));
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};
