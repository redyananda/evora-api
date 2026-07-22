import express from "express";
import {
  createEventController,
  getEventBySlugController,
  getEventsController,
} from "../controllers/event.controller.js";
import { verifyRole, verifyToken } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";
import { validateBody } from "../middlewares/validate.middleware.js";
import { createEventSchema } from "../validators/event.validator.js";

const eventRoutes = express.Router();

eventRoutes.get("/", getEventsController)
eventRoutes.get("/:slug", getEventBySlugController)


eventRoutes.post(
  "/",
  verifyToken,
  verifyRole("ORGANIZER"),
  upload().fields([{ name: "thumbnail", maxCount: 1 }]),
  validateBody(createEventSchema),
  createEventController,
)

export { eventRoutes }
