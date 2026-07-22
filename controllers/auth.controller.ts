import type { Request, Response, NextFunction } from "express";
import {
  loginService,
  registerService,
  requestPasswordResetService,
  resetPasswordService,
} from "../services/auth.service.js";
import { ApiError } from "../utils/api-error.js";

export const registerController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { firstName, lastName, email, password, role, referralCode, organizerName } =
      req.body;

    if (!firstName || !lastName || !email || !password || !role) {
      throw new ApiError(
        "firstName, lastName, email, password, and role are required",
        400
      );
    }
    if (role !== "CUSTOMER" && role !== "ORGANIZER") {
      throw new ApiError("Role must be CUSTOMER or ORGANIZER", 400);
    }

    const result = await registerService({
      firstName,
      lastName,
      email,
      password,
      role,
      referralCode,
      organizerName,
    });

    res.status(201).json({
      message: result.coupon
        ? "Registration successful. A referral coupon has been added to your account."
        : "Registration successful",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
export const loginController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new ApiError("Email and password are required", 400);
    }

    res.status(200).json({
      message: "Login successful",
      data: await loginService({ email, password }),
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.body.email) {
      throw new ApiError("Email is required", 400);
    }

    const result = await requestPasswordResetService(req.body.email);
    res.status(200).json({
      message:
        "If the email is registered, a password reset link has been sent and is valid for 1 hour.",
      data:
        process.env.NODE_ENV === "production"
          ? undefined
          : { resetToken: result.resetToken },
    });
  } catch (error) {
    next(error);
  }
};

export const resetPasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      throw new ApiError("Token and new password are required", 400);
    }
    await resetPasswordService(token, newPassword);
    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    next(error);
  }
};
