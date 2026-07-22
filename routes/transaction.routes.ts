import { Router } from "express";
import {
  createTransactionController,
  getTransactionByIdController,
  uploadPaymentProofController,
} from "../controllers/transaction.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { createTransactionSchema } from "../validators/transaction.validator.js";

export const transactionRoutes = Router();

transactionRoutes.post(
  "/",
  verifyToken,
  validateBody(createTransactionSchema),
  createTransactionController,
);

transactionRoutes.get("/:id", verifyToken, getTransactionByIdController);

transactionRoutes.patch(
  "/:id/payment-proof",
  verifyToken,
  upload(5).single("paymentProof"),
  uploadPaymentProofController,
);
