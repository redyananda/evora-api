import z from "zod";

export const createVoucherSchema = z
  .object({
    eventId: z.coerce.number().int().positive("Event is invalid"),
    code: z
      .string()
      .trim()
      .min(3, "Voucher code must be at least 3 characters")
      .max(24, "Voucher code is too long")
      .regex(/^[A-Za-z0-9]+$/, "Voucher code can only contain letters and numbers")
      .transform((value) => value.toUpperCase()),
    discount: z.coerce
      .number()
      .int("Discount must be a whole number")
      .positive("Discount must be greater than 0"),
    total: z.coerce
      .number()
      .int("Quantity must be a whole number")
      .min(1, "Voucher quantity must be at least 1"),
    startDate: z.coerce.date({ message: "Start date is invalid" }),
    endDate: z.coerce.date({ message: "End date is invalid" }),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export type CreateVoucherSchema = z.infer<typeof createVoucherSchema>;
