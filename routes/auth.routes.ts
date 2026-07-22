import { Router } from "express";
import {
  forgotPasswordController,
  loginController,
  registerController,
  resetPasswordController,
} from "../controllers/auth.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { getProfileController } from "../controllers/profile.controller.js";

export const authRoutes = Router();

// POST /auth/register
authRoutes.post("/register", registerController);

// POST /auth/login
authRoutes.post("/login", loginController);

authRoutes.post("/forgot-password", forgotPasswordController);
authRoutes.post("/reset-password", resetPasswordController);

// GET /auth/me  — example protected route to fetch current user info
authRoutes.get("/me", verifyToken, getProfileController);
