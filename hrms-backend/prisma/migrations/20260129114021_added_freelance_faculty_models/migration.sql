-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'FREELANCE_FACULTY_MANAGER';

-- CreateTable
CREATE TABLE "freelance_faculty_managers" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freelance_faculty_managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freelance_faculties" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjects" TEXT[],
    "preferredDaysOfWeek" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "freelanceFacultyManagerId" TEXT,

    CONSTRAINT "freelance_faculties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freelance_faculty_day_entries" (
    "id" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "classesCount" INTEGER NOT NULL DEFAULT 0,
    "subjects" TEXT[],
    "batch" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freelance_faculty_day_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "freelance_faculty_managers_employeeId_key" ON "freelance_faculty_managers"("employeeId");

-- CreateIndex
CREATE INDEX "freelance_faculties_managerId_idx" ON "freelance_faculties"("managerId");

-- CreateIndex
CREATE INDEX "freelance_faculty_day_entries_facultyId_date_idx" ON "freelance_faculty_day_entries"("facultyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "freelance_faculty_day_entries_facultyId_date_key" ON "freelance_faculty_day_entries"("facultyId", "date");

-- AddForeignKey
ALTER TABLE "freelance_faculty_managers" ADD CONSTRAINT "freelance_faculty_managers_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freelance_faculties" ADD CONSTRAINT "freelance_faculties_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freelance_faculties" ADD CONSTRAINT "freelance_faculties_freelanceFacultyManagerId_fkey" FOREIGN KEY ("freelanceFacultyManagerId") REFERENCES "freelance_faculty_managers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freelance_faculty_day_entries" ADD CONSTRAINT "freelance_faculty_day_entries_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "freelance_faculties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freelance_faculty_day_entries" ADD CONSTRAINT "freelance_faculty_day_entries_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
