-- AlterTable: jadikan slug wajib (semua baris sudah terisi)
ALTER TABLE "events" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex: unique constraint pada slug
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");
