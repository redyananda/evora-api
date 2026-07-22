import type { Request, Response, NextFunction } from "express";
import {
  changePasswordService,
  getProfileService,
  updateProfileService,
} from "../services/profile.service.js";
import { ApiError } from "../utils/api-error.js";

const getUserId = (req: Request): number => {
  if (!req.user) throw new ApiError("User is not authenticated", 401);
  return req.user.id;
};

export const getProfileController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.status(200).json({ data: await getProfileService(getUserId(req)) });
  } catch (error) {
    next(error);
  }
};

export const updateProfileController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await updateProfileService(getUserId(req), req.body);
    res.status(200).json({ message: "Profile updated successfully", data });
  } catch (error) {
    next(error);
  }
};

export const changePasswordController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      throw new ApiError("Current password and new password are required", 400);
    }
    await changePasswordService(getUserId(req), currentPassword, newPassword);
    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
};
