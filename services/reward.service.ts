import { prisma } from "../lib/prisma.js";

export const REFERRAL_POINT_REWARD = 10_000;

export const getReferralCouponDiscount = (): number => {
  const configuredValue = Number(process.env.REFERRAL_COUPON_DISCOUNT ?? 10_000);
  return Number.isInteger(configuredValue) && configuredValue > 0
    ? configuredValue
    : 10_000;
};

export const syncActivePointBalance = async (userId: number): Promise<number> => {
  const aggregate = await prisma.point.aggregate({
    where: {
      userId,
      expiredAt: { gt: new Date() },
    },
    _sum: { amount: true },
  });

  const balance = aggregate._sum.amount ?? 0;
  await prisma.user.update({
    where: { id: userId },
    data: { userPoint: balance },
  });

  return balance;
};

