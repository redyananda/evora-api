import express from "express";
import { getEventsController } from "../controllers/event.controller.js";

const eventRoutes = express.Router();

eventRoutes.get("/", getEventsController)

export { eventRoutes }