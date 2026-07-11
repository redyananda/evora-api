import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api-error.js";

// Global error handler — must have 4 parameters so Express recognises it
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error("[Unhandled Error]", err);
  res.status(500).json({ message: "Internal server error" });
};
