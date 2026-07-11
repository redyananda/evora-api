import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";

// Generate unique 8-char alphanumeric referral code
function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function generateUniqueReferralCode(): Promise<string> {
  let code = generateReferralCode();
  let exists = await prisma.user.findUnique({ where: { referralCode: code } });
  while (exists) {
    code = generateReferralCode();
    exists = await prisma.user.findUnique({ where: { referralCode: code } });
  }
  return code;
}

// ─── Register ────────────────────────────────────────────────────────────────

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: "CUSTOMER" | "ORGANIZER";
  referralCode?: string; // code used BY this new user (to get benefit)
  organizerName?: string; // required when role === ORGANIZER
}

export const registerService = async (payload: RegisterPayload) => {
  const { firstName, lastName, email, password, role, referralCode, organizerName } = payload;

  // 1. Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError("Email sudah terdaftar", 400);
  }

  // 2. Validate referral code if provided (only customers can use referral)
  let referredById: number | undefined;
  if (referralCode) {
    if (role !== "CUSTOMER") {
      throw new ApiError("Hanya pelanggan yang bisa menggunakan kode referral", 400);
    }
    const referrer = await prisma.user.findUnique({ where: { referralCode } });
    if (!referrer) {
      throw new ApiError("Kode referral tidak valid", 400);
    }
    referredById = referrer.id;
  }

  // 3. Organizer must supply organizerName
  if (role === "ORGANIZER" && !organizerName?.trim()) {
    throw new ApiError("Nama organisasi wajib diisi untuk event organizer", 400);
  }

  // 4. Hash password
  const hashedPassword = await argon2.hash(password);

  // 5. Generate unique referral code for the new user
  const newReferralCode = await generateUniqueReferralCode();

  // 6. Create user (and organizer profile if needed) in a transaction
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        userRole: role,
        referralCode: newReferralCode,
        referredById: referredById ?? null,
      },
    });

    // If registered with a referral code, reward the referrer with 10,000 points (90-day expiry)
    if (referredById) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 90);
      await tx.point.create({
        data: {
          userId: referredById,
          amount: 10000,
          expiredAt: expiry,
        },
      });
      // Also update referrer's total points
      await tx.user.update({
        where: { id: referredById },
        data: { userPoint: { increment: 10000 } },
      });
    }

    // Create organizer profile
    if (role === "ORGANIZER") {
      await tx.organizer.create({
        data: {
          userId: created.id,
          organizerName: organizerName!.trim(),
        },
      });
    }

    return created;
  });

  // 7. Return user without password
  const { password: _pw, ...safeUser } = user;
  return safeUser;
};

// ─── Login ────────────────────────────────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export const loginService = async (payload: LoginPayload) => {
  const { email, password } = payload;

  // 1. Find user
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new ApiError("Email atau password salah", 401);
  }

  // 2. Verify password
  const isValid = await argon2.verify(user.password, password);
  if (!isValid) {
    throw new ApiError("Email atau password salah", 401);
  }

  // 3. Sign JWT
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new ApiError("JWT secret tidak dikonfigurasi", 500);
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    role: user.userRole,
    firstName: user.firstName,
    lastName: user.lastName,
  };

  const token = jwt.sign(tokenPayload, secret, { expiresIn: "7d" });

  const { password: _pw, resetToken: _rt, ...safeUser } = user;

  return { user: safeUser, token };
};
