/*
  Warnings:

  - You are about to drop the column `category_id` on the `events` table. All the data in the column will be lost.
  - You are about to drop the `categories` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `category` to the `events` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('MUSIC', 'TECH_AND_INNOVATION', 'FOOD_AND_DRINK', 'ARTS_AND_CULTURE', 'BUSINESS', 'WELLNESS');

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_category_id_fkey";

-- DropIndex
DROP INDEX "events_category_id_idx";

-- AlterTable
ALTER TABLE "events" DROP COLUMN "category_id",
ADD COLUMN     "category" "EventCategory" NOT NULL;

-- DropTable
DROP TABLE "categories";

-- CreateIndex
CREATE INDEX "events_category_idx" ON "events"("category");
