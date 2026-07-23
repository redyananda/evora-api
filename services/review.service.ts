import { TransactionStatus } from "../generated/prisma/enums.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/api-error.js";
import { nowInJakarta } from "../utils/date.js";
import { type CreateReviewSchema } from "../validators/review.validator.js";

export const createReviewService = async (
  userId: number,
  transactionId: number,
  body: CreateReviewSchema,
) => {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      event: { select: { organizerId: true, endDate: true } },
      review: { select: { id: true } },
    },
  });

  if (!transaction || transaction.userId !== userId) {
    throw new ApiError("Order not found", 404);
  }


  if (transaction.status !== TransactionStatus.DONE) {
    throw new ApiError("You can only review a completed order", 400);
  }

  if (transaction.event.endDate > nowInJakarta()) {
    throw new ApiError(
      "You can only leave a review after the event has ended",
      400,
    );
  }

  if (transaction.review) {
    throw new ApiError("You have already reviewed this event", 409);
  }

  const { organizerId } = transaction.event;

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        userId,
        transactionId,
        rating: body.rating,
        comment: body.comment && body.comment.length > 0 ? body.comment : null,
      },
    });


    const aggregate = await tx.review.aggregate({
      where: { transaction: { event: { organizerId } } },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.organizer.update({
      where: { id: organizerId },
      data: {
        rating: aggregate._avg.rating ?? 0,
        totalReviews: aggregate._count.rating,
      },
    });

    return created;
  });

  return { message: "Review submitted successfully", data: review };
};
