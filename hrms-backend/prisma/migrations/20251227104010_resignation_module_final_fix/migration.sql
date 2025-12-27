-- AlterTable
ALTER TABLE "Resignation" ADD COLUMN     "declaration" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "handoverDetail" TEXT,
ADD COLUMN     "isAdminDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEmployeeDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "noticePeriod" INTEGER,
ADD COLUMN     "reasonType" TEXT NOT NULL DEFAULT 'Other',
ADD COLUMN     "rejectReason" TEXT;
