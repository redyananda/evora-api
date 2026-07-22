import { Router } from "express";
import {
  createTransactionController,
  getTransactionByIdController,
  uploadPaymentProofController,
} from "../controllers/transaction.controller.js";
import { verifyRole, verifyToken } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { createTransactionSchema } from "../validators/transaction.validator.js";

export const transactionRoutes = Router();

transactionRoutes.use(verifyToken, verifyRole("CUSTOMER"));

transactionRoutes.post(
  "/",
  validateBody(createTransactionSchema),
  createTransactionController,
);

transactionRoutes.get("/:id", getTransactionByIdController);

transactionRoutes.patch(
  "/:id/payment-proof",
  upload(5).single("paymentProof"),
  uploadPaymentProofController,
);
