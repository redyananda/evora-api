import type { NextFunction, Request, Response } from "express";
import {
  createVoucherService,
  deleteVoucherService,
  getEventVouchersService,
  getOrganizerVouchersService,
} from "../services/voucher.service.js";
import { ApiError } from "../utils/api-error.js";
import type { CreateVoucherSchema } from "../validators/voucher.validator.js";

const userId = (req: Request) => {
  if (!req.user) throw new ApiError("Unauthenticated", 401);
  return req.user.id;
};

const positiveInt = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ApiError("Invalid numeric identifier", 400);
  }
  return parsed;
};

export const createVoucherController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await createVoucherService(
      userId(req),
      req.body as CreateVoucherSchema
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getOrganizerVouchersController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = req.query.eventId ? positiveInt(req.query.eventId) : undefined;
    res.status(200).json(await getOrganizerVouchersService(userId(req), eventId));
  } catch (error) {
    next(error);
  }
};

export const deleteVoucherController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await deleteVoucherService(userId(req), positiveInt(req.params.voucherId));
    res.status(200).json({ message: "Voucher deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const getEventVouchersController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.status(200).json(await getEventVouchersService(req.params.slug as string));
  } catch (error) {
    next(error);
  }
};
