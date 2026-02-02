-- AlterTable
ALTER TABLE "AttendanceCorrection" ADD COLUMN     "checkIn" TIMESTAMP(3),
ADD COLUMN     "checkOut" TIMESTAMP(3),
ADD COLUMN     "witness" TEXT;
