import { Router } from "express";
import {
  createOrganizerEventController,
  deleteOrganizerEventController,
  getEventParticipantsController,
  getOrganizerDashboardController,
  getOrganizerEventsController,
  getOrganizerTransactionsController,
  updateOrganizerEventController,
  updateTransactionStatusController,
} from "../controllers/organizer.controller.js";
import { verifyRole, verifyToken } from "../middlewares/auth.middleware.js";

export const organizerRoutes = Router();

organizerRoutes.use(verifyToken, verifyRole("ORGANIZER"));
organizerRoutes.get("/dashboard", getOrganizerDashboardController);
organizerRoutes.get("/events", getOrganizerEventsController);
organizerRoutes.post("/events", createOrganizerEventController);
organizerRoutes.patch("/events/:eventId", updateOrganizerEventController);
organizerRoutes.delete("/events/:eventId", deleteOrganizerEventController);
organizerRoutes.get("/events/:eventId/participants", getEventParticipantsController);
organizerRoutes.get("/transactions", getOrganizerTransactionsController);
organizerRoutes.patch("/transactions/:transactionId/status", updateTransactionStatusController);
