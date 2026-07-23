import z from "zod";

export const createTransactionSchema = z.object({
  eventId: z.coerce.number().int().positive("Event is invalid"),
  quantity: z.coerce
    .number()
    .int()
    .min(1, "Quantity must be at least 1")
    .max(3, "Maximum 3 tickets per order"),
  voucherCode: z.string().trim().min(1).optional(),
});

export type CreateTransactionSchema = z.infer<typeof createTransactionSchema>;
