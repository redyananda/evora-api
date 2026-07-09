-- AlterTable: tambah kolom slug sebagai optional (nullable) dulu.
-- Nanti setelah semua slug terisi, dibuat migration terpisah untuk NOT NULL + UNIQUE.
ALTER TABLE "events" ADD COLUMN "slug" TEXT;
