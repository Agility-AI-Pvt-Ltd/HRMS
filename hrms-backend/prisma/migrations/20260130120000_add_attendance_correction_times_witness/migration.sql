-- AlterTable: add checkIn, checkOut, witness for Cancel Leave (Missed Check-in)
-- Check if columns exist before adding them to avoid errors
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'AttendanceCorrection' AND column_name = 'checkIn') THEN
        ALTER TABLE "AttendanceCorrection" ADD COLUMN "checkIn" TIMESTAMP(3);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'AttendanceCorrection' AND column_name = 'checkOut') THEN
        ALTER TABLE "AttendanceCorrection" ADD COLUMN "checkOut" TIMESTAMP(3);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'AttendanceCorrection' AND column_name = 'witness') THEN
        ALTER TABLE "AttendanceCorrection" ADD COLUMN "witness" TEXT;
    END IF;
END $$;
