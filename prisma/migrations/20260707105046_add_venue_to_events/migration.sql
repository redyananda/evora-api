/*
  Warnings:

  - Added the required column `venue` to the `events` table.
    Existing rows are backfilled with an empty string ('') so the migration
    can run on a non-empty table. Update these rows manually afterwards.

*/
-- AlterTable: add the column with a temporary default to backfill existing rows,
-- then drop the default so the schema stays NOT NULL without a default (no drift).
ALTER TABLE "events" ADD COLUMN "venue" TEXT NOT NULL DEFAULT '';
ALTER TABLE "events" ALTER COLUMN "venue" DROP DEFAULT;
