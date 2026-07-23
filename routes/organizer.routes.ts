import { Router } from "express";
import {
  deleteOrganizerEventController,
  getEventParticipantsController,
  getOrganizerDashboardController,
  getOrganizerEventsController,
  getOrganizerTransactionsController,
  updateOrganizerEventController,
  updateTransactionStatusController,
} from "../controllers/organizer.controller.js";
import {
  createVoucherController,
  deleteVoucherController,
  getOrganizerVouchersController,
} from "../controllers/voucher.controller.js";
import { verifyRole, verifyToken } from "../middlewares/auth.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { createVoucherSchema } from "../validators/voucher.validator.js";

export const organizerRoutes = Router();

organizerRoutes.use(verifyToken, verifyRole("ORGANIZER"));
organizerRoutes.get("/dashboard", getOrganizerDashboardController);
organizerRoutes.get("/events", getOrganizerEventsController);
organizerRoutes.patch("/events/:eventId", updateOrganizerEventController);
organizerRoutes.delete("/events/:eventId", deleteOrganizerEventController);
organizerRoutes.get("/events/:eventId/participants", getEventParticipantsController);
organizerRoutes.get("/transactions", getOrganizerTransactionsController);
organizerRoutes.patch("/transactions/:transactionId/status", updateTransactionStatusController);
organizerRoutes.get("/vouchers", getOrganizerVouchersController);
organizerRoutes.post("/vouchers", validateBody(createVoucherSchema), createVoucherController);
organizerRoutes.delete("/vouchers/:voucherId", deleteVoucherController);
