import * as argon2 from "argon2";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { syncActivePointBalance } from "./reward.service.js";

const isValidProfilePicture = (value: string): boolean =>
  /^https?:\/\//i.test(value) || /^data:image\/(png|jpe?g|webp);base64,/i.test(value);

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string | null;
  address?: string | null;
  profilePicture?: string | null;
  organizerName?: string;
  organizerDescription?: string | null;
  organizerLogo?: string | null;
}

export const getProfileService = async (userId: number) => {
  const userPoint = await syncActivePointBalance(userId);
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      referralCode: true,
      referredById: true,
      profilePicture: true,
      phoneNumber: true,
      userRole: true,
      address: true,
      createdAt: true,
      updatedAt: true,
      organizer: {
        select: {
          organizerName: true,
          organizerDescription: true,
          organizerLogo: true,
          rating: true,
          totalReviews: true,
        },
      },
      points: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          expiredAt: true,
        },
      },
      userCoupons: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          isUsed: true,
          usedAt: true,
          createdAt: true,
          coupon: {
            select: {
              code: true,
              discount: true,
              expiredAt: true,
            },
          },
        },
      },
      _count: { select: { referrals: true } },
    },
  });

  if (!user) throw new ApiError("User not found", 404);

  const { _count, userCoupons, ...profile } = user;
  return {
    ...profile,
    userPoint,
    referralCount: _count.referrals,
    points: user.points.map((point) => ({
      ...point,
      status: point.expiredAt > now ? "ACTIVE" : "EXPIRED",
    })),
    coupons: userCoupons.map(({ coupon, ...assignment }) => ({
      ...assignment,
      ...coupon,
      status: assignment.isUsed
        ? "USED"
        : coupon.expiredAt <= now
          ? "EXPIRED"
          : "ACTIVE",
    })),
  };
};

export const updateProfileService = async (
  userId: number,
  payload: UpdateProfilePayload
) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { organizer: true },
  });
  if (!currentUser) throw new ApiError("User not found", 404);

  const userData: Prisma.UserUpdateInput = {};
  if (payload.firstName !== undefined) {
    if (!payload.firstName.trim()) throw new ApiError("First name is required", 400);
    userData.firstName = payload.firstName.trim();
  }
  if (payload.lastName !== undefined) {
    if (!payload.lastName.trim()) throw new ApiError("Last name is required", 400);
    userData.lastName = payload.lastName.trim();
  }
  if (payload.email !== undefined) {
    const email = payload.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new ApiError("Invalid email format", 400);
    }
    const owner = await prisma.user.findUnique({ where: { email } });
    if (owner && owner.id !== userId) throw new ApiError("Email is already in use", 409);
    userData.email = email;
  }
  if (payload.phoneNumber !== undefined) {
    userData.phoneNumber = payload.phoneNumber?.trim() || null;
  }
  if (payload.address !== undefined) {
    userData.address = payload.address?.trim() || null;
  }
  if (payload.profilePicture !== undefined) {
    if (
      payload.profilePicture &&
      (!isValidProfilePicture(payload.profilePicture) || payload.profilePicture.length > 2_800_000)
    ) {
      throw new ApiError("Profile picture must be a URL or an image up to 2 MB", 400);
    }
    userData.profilePicture = payload.profilePicture || null;
  }

  const hasOrganizerPayload =
    payload.organizerName !== undefined ||
    payload.organizerDescription !== undefined ||
    payload.organizerLogo !== undefined;
  if (hasOrganizerPayload && !currentUser.organizer) {
    throw new ApiError("Organizer data can only be changed by an event organizer", 403);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: userData });

    if (hasOrganizerPayload && currentUser.organizer) {
      const organizerData: Prisma.OrganizerUpdateInput = {};
      if (payload.organizerName !== undefined) {
        if (!payload.organizerName.trim()) {
          throw new ApiError("Organization name is required", 400);
        }
        organizerData.organizerName = payload.organizerName.trim();
      }
      if (payload.organizerDescription !== undefined) {
        organizerData.organizerDescription =
          payload.organizerDescription?.trim() || null;
      }
      if (payload.organizerLogo !== undefined) {
        organizerData.organizerLogo = payload.organizerLogo?.trim() || null;
      }
      await tx.organizer.update({
        where: { userId },
        data: organizerData,
      });
    }
  });

  return getProfileService(userId);
};

export const changePasswordService = async (
  userId: number,
  currentPassword: string,
  newPassword: string
) => {
  if (newPassword.length < 8) {
    throw new ApiError("New password must be at least 8 characters", 400);
  }
  if (currentPassword === newPassword) {
    throw new ApiError("New password must be different from the current password", 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError("User not found", 404);
  if (!(await argon2.verify(user.password, currentPassword))) {
    throw new ApiError("Current password is incorrect", 400);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: await argon2.hash(newPassword),
      resetToken: null,
      resetTokenExpires: null,
    },
  });
};
