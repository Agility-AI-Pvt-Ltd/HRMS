-- CreateEnum
CREATE TYPE "ResignStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Resignation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastWorking" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "ResignStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resignation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Resignation" ADD CONSTRAINT "Resignation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
