import { Router } from "express";
import { loginController, registerController } from "../controllers/auth.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

export const authRoutes = Router();

// POST /auth/register
authRoutes.post("/register", registerController);

// POST /auth/login
authRoutes.post("/login", loginController);

// GET /auth/me  — example protected route to fetch current user info
authRoutes.get("/me", verifyToken, (req, res) => {
  res.status(200).json({ data: req.user });
});
