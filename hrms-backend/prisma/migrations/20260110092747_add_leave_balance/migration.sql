-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lastLeaveCredit" TIMESTAMP(3),
ADD COLUMN     "leaveBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
