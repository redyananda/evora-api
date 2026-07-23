import { Router } from "express";
import { getPublicOrganizerProfileController } from "../controllers/organizer.controller.js";

export const publicOrganizerRoutes = Router();

publicOrganizerRoutes.get("/:id", getPublicOrganizerProfileController);
