/*
  Warnings:

  - The values [FREELANCE_FACULTY_MANAGER] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `createdBy` on the `freelance_faculty_day_entries` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'AGILITY_EMPLOYEE', 'LYF_EMPLOYEE');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'AGILITY_EMPLOYEE';
COMMIT;

-- DropForeignKey
ALTER TABLE "freelance_faculty_day_entries" DROP CONSTRAINT "freelance_faculty_day_entries_createdBy_fkey";

-- AlterTable
ALTER TABLE "freelance_faculty_day_entries" DROP COLUMN "createdBy";
