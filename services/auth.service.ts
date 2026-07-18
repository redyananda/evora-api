import * as argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { addCalendarMonths } from "../utils/date.js";
import {
  getReferralCouponDiscount,
  REFERRAL_POINT_REWARD,
  syncActivePointBalance,
} from "./reward.service.js";

const generateCode = (length: number): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const generateUniqueReferralCode = async (): Promise<string> => {
  let code = generateCode(8);
  while (await prisma.user.findUnique({ where: { referralCode: code } })) {
    code = generateCode(8);
  }
  return code;
};

const generateUniqueCouponCode = async (): Promise<string> => {
  let code = `REF-${generateCode(10)}`;
  while (await prisma.coupon.findUnique({ where: { code } })) {
    code = `REF-${generateCode(10)}`;
  }
  return code;
};

const hashResetToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: "CUSTOMER" | "ORGANIZER";
  referralCode?: string;
  organizerName?: string;
}

export const registerService = async (payload: RegisterPayload) => {
  const email = payload.email.trim().toLowerCase();
  const firstName = payload.firstName.trim();
  const lastName = payload.lastName.trim();
  const usedReferralCode = payload.referralCode?.trim().toUpperCase();

  if (!firstName || !lastName) {
    throw new ApiError("Nama depan dan nama belakang wajib diisi", 400);
  }
  if (payload.password.length < 8) {
    throw new ApiError("Password minimal 8 karakter", 400);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError("Email sudah terdaftar", 409);
  }

  let referredById: number | undefined;
  if (usedReferralCode) {
    if (payload.role !== "CUSTOMER") {
      throw new ApiError("Hanya pelanggan yang bisa menggunakan kode referral", 400);
    }
    const referrer = await prisma.user.findUnique({
      where: { referralCode: usedReferralCode },
    });
    if (!referrer) {
      throw new ApiError("Kode referral tidak valid", 400);
    }
    referredById = referrer.id;
  }

  if (payload.role === "ORGANIZER" && !payload.organizerName?.trim()) {
    throw new ApiError("Nama organisasi wajib diisi untuk event organizer", 400);
  }

  const hashedPassword = await argon2.hash(payload.password);
  const newReferralCode = await generateUniqueReferralCode();
  const referralCouponCode = referredById
    ? await generateUniqueCouponCode()
    : undefined;
  const creditedAt = new Date();
  const rewardExpiresAt = addCalendarMonths(creditedAt, 3);

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        userRole: payload.role,
        referralCode: newReferralCode,
        referredById: referredById ?? null,
      },
    });

    let coupon:
      | { code: string; discount: number; expiredAt: Date }
      | undefined;

    if (referredById && referralCouponCode) {
      await tx.point.create({
        data: {
          userId: referredById,
          amount: REFERRAL_POINT_REWARD,
          expiredAt: rewardExpiresAt,
          createdAt: creditedAt,
        },
      });
      await tx.user.update({
        where: { id: referredById },
        data: { userPoint: { increment: REFERRAL_POINT_REWARD } },
      });

      const createdCoupon = await tx.coupon.create({
        data: {
          code: referralCouponCode,
          discount: getReferralCouponDiscount(),
          expiredAt: rewardExpiresAt,
          createdAt: creditedAt,
          userCoupons: { create: { userId: created.id } },
        },
      });
      coupon = {
        code: createdCoupon.code,
        discount: createdCoupon.discount,
        expiredAt: createdCoupon.expiredAt,
      };
    }

    if (payload.role === "ORGANIZER") {
      await tx.organizer.create({
        data: {
          userId: created.id,
          organizerName: payload.organizerName!.trim(),
        },
      });
    }

    const { password: _password, resetToken: _resetToken, ...safeUser } = created;
    return { ...safeUser, coupon };
  });

  return result;
};

export interface LoginPayload {
  email: string;
  password: string;
}

export const loginService = async (payload: LoginPayload) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email.trim().toLowerCase() },
  });
  if (!user || !(await argon2.verify(user.password, payload.password))) {
    throw new ApiError("Email atau password salah", 401);
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new ApiError("JWT secret tidak dikonfigurasi", 500);
  }

  const userPoint = await syncActivePointBalance(user.id);
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.userRole,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    secret,
    { expiresIn: "7d" }
  );

  const {
    password: _password,
    resetToken: _resetToken,
    resetTokenExpires: _resetTokenExpires,
    ...safeUser
  } = user;

  return { user: { ...safeUser, userPoint }, token };
};

export const requestPasswordResetService = async (emailInput: string) => {
  const email = emailInput.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Keep the public response identical so this endpoint cannot enumerate users.
  if (!user) return { resetToken: undefined };

  const resetToken = randomBytes(32).toString("hex");
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: hashResetToken(resetToken),
      resetTokenExpires,
    },
  });

  return { resetToken };
};

export const resetPasswordService = async (
  token: string,
  newPassword: string
) => {
  if (newPassword.length < 8) {
    throw new ApiError("Password baru minimal 8 karakter", 400);
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: hashResetToken(token),
      resetTokenExpires: { gt: new Date() },
    },
  });
  if (!user) {
    throw new ApiError("Token reset tidak valid atau sudah kedaluwarsa", 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await argon2.hash(newPassword),
      resetToken: null,
      resetTokenExpires: null,
    },
  });
};
