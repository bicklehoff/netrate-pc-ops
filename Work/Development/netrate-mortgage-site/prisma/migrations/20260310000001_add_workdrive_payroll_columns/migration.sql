-- AlterTable — Add WorkDrive and Payroll columns to loans
-- These fields were in the schema but never had a migration created.
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "work_drive_folder_id" TEXT;
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "work_drive_subfolders" JSONB;
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "cd_work_drive_file_id" TEXT;
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "cd_file_name" TEXT;
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "payroll_sent_at" TIMESTAMP(3);
