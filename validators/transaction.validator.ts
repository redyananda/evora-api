import z from "zod";

// Sent as JSON. userId is NOT accepted from the client — it is derived from the
// authenticated token. The price is recomputed on the server, so the client
// only tells us WHAT is being ordered, never how much it costs.
export const createTransactionSchema = z.object({
  eventId: z.coerce.number().int().positive("Event is invalid"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  voucherCode: z.string().trim().min(1).optional(),
});

export type CreateTransactionSchema = z.infer<typeof createTransactionSchema>;
