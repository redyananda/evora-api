import type { Request, Response, NextFunction } from "express";
import { loginService, registerService } from "../services/auth.service.js";
import { ApiError } from "../utils/api-error.js";

export const registerController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { firstName, lastName, email, password, role, referralCode, organizerName } =
      req.body;

    // Basic field validation
    if (!firstName || !lastName || !email || !password || !role) {
      throw new ApiError(
        "firstName, lastName, email, password, dan role wajib diisi",
        400
      );
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
      message: "Registrasi berhasil",
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

    const result = await loginService({ email, password });

    res.status(200).json({
      message: "Login berhasil",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
