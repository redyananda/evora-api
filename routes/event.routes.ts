import express from "express";
import { getEventBySlugController, getEventsController } from "../controllers/event.controller.js";

const eventRoutes = express.Router();

eventRoutes.get("/", getEventsController)
eventRoutes.get("/:slug", getEventBySlugController)

export { eventRoutes }