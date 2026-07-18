import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/api-error.js";

// ─── verifyToken ──────────────────────────────────────────────────────────────
// Reads the Bearer token from Authorization header, verifies it, and attaches
// the decoded payload to req.user so downstream handlers can use it.

export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError("Akses ditolak: token tidak ditemukan", 401);
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      throw new ApiError("Akses ditolak: token tidak ditemukan", 401);
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new ApiError("JWT secret tidak dikonfigurasi", 500);
    }

    const decoded = jwt.verify(token, secret) as unknown as {
      id: number;
      email: string;
      role: string;
      firstName: string;
      lastName: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new ApiError("Token sudah kedaluwarsa", 401));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new ApiError("Token tidak valid", 401));
    } else {
      next(error);
    }
  }
};

// ─── verifyRole ───────────────────────────────────────────────────────────────
// Factory: returns a middleware that allows only the listed roles.
// Usage: router.get('/admin-only', verifyToken, verifyRole('ADMIN'))
//        router.get('/org-page',   verifyToken, verifyRole('ORGANIZER', 'ADMIN'))

export const verifyRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError("Akses ditolak: tidak terautentikasi", 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(
          `Akses ditolak: hanya ${allowedRoles.join(", ")} yang diizinkan`,
          403
        )
      );
    }

    next();
  };
};
