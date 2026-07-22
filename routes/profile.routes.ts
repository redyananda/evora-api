import { Router } from "express";
import {
  changePasswordController,
  getProfileController,
  updateProfileController,
} from "../controllers/profile.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

export const profileRoutes = Router();

profileRoutes.use(verifyToken);
profileRoutes.get("/", getProfileController);
profileRoutes.patch("/", updateProfileController);
profileRoutes.patch("/password", changePasswordController);

