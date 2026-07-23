import type { Request, Response } from "express";
import {
  createTransactionService,
  getTransactionByIdService,
  getUserTransactionsService,
  uploadPaymentProofService,
} from "../services/transaction.service.js";
import { createReviewService } from "../services/review.service.js";
import { ApiError } from "../utils/api-error.js";

export const createTransactionController = async (
  req: Request,
  res: Response,
) => {
  const userId = req.user!.id;
  const result = await createTransactionService(userId, req.body);
  res.status(201).send(result);
};

export const getUserTransactionsController = async (
  req: Request,
  res: Response,
) => {
  const userId = req.user!.id;
  const result = await getUserTransactionsService(userId);
  res.status(200).send(result);
};

export const getTransactionByIdController = async (
  req: Request,
  res: Response,
) => {
  const userId = req.user!.id;
  const transactionId = Number(req.params.id);
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    throw new ApiError("Invalid transaction id", 400);
  }
  const result = await getTransactionByIdService(transactionId, userId);
  res.status(200).send(result);
};

export const uploadPaymentProofController = async (
  req: Request,
  res: Response,
) => {
  const userId = req.user!.id;
  const transactionId = Number(req.params.id);
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    throw new ApiError("Invalid transaction id", 400);
  }

  const proof = req.file;
  if (!proof) throw new ApiError("Payment proof is required", 400);

  const result = await uploadPaymentProofService(transactionId, userId, proof);
  res.status(200).send(result);
};

export const createReviewController = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const transactionId = Number(req.params.id);
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    throw new ApiError("Invalid transaction id", 400);
  }

  const result = await createReviewService(userId, transactionId, req.body);
  res.status(201).send(result);
};
