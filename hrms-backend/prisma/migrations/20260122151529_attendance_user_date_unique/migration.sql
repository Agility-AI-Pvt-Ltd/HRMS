/*
  Warnings:

  - A unique constraint covering the columns `[userId,date]` on the table `attendances` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "attendances_userId_date_idx";

-- CreateIndex
CREATE UNIQUE INDEX "attendances_userId_date_key" ON "attendances"("userId", "date");
