-- Split the single deadline field into two: `payment_deadline` keeps the
-- 2-hour payment window, `confirmation_deadline` holds the 3-day organizer
-- confirmation window. Nullable because it only applies once a customer has
-- uploaded payment proof and the transaction is awaiting confirmation.
ALTER TABLE "transactions"
  ADD COLUMN "confirmation_deadline" TIMESTAMP(3);

-- Backfill in-flight rows: any transaction already awaiting confirmation
-- previously stored its 3-day deadline in `payment_deadline` (it was
-- overwritten on upload). Move that value over so the sweep can still cancel
-- them; fall back to paid_at + 3 days if needed.
UPDATE "transactions"
SET "confirmation_deadline" = COALESCE("payment_deadline", "paid_at" + INTERVAL '3 days')
WHERE "status" = 'WAITING_FOR_ADMIN_CONFIRMATION';
