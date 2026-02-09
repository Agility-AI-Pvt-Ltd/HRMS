/*
  Warnings:

  - You are about to drop the column `witness` on the `AttendanceCorrection` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AttendanceCorrection" DROP COLUMN "witness",
ADD COLUMN     "witnessId" TEXT;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_witnessId_fkey" FOREIGN KEY ("witnessId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
