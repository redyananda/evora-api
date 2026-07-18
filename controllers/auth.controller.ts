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
        "firstName, lastName, email, password, dan role wajib diisi",
        400
      );
    }
    if (role !== "CUSTOMER" && role !== "ORGANIZER") {
      throw new ApiError("Role harus CUSTOMER atau ORGANIZER", 400);
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
        ? "Registrasi berhasil. Kupon referral telah ditambahkan ke akun Anda."
        : "Registrasi berhasil",
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
      throw new ApiError("Email dan password wajib diisi", 400);
    }

    res.status(200).json({
      message: "Login berhasil",
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
      throw new ApiError("Email wajib diisi", 400);
    }

    const result = await requestPasswordResetService(req.body.email);
    res.status(200).json({
      message:
        "Jika email terdaftar, instruksi reset password telah dibuat dan berlaku selama 1 jam.",
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
      throw new ApiError("Token dan password baru wajib diisi", 400);
    }
    await resetPasswordService(token, newPassword);
    res.status(200).json({ message: "Password berhasil direset" });
  } catch (error) {
    next(error);
  }
};
