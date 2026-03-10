-- AlterTable — Add MCR/HMDA reporting and CRM fields to loans
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "action_taken" TEXT;
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "action_taken_date" TIMESTAMP(3);
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "application_method" TEXT;
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "lien_status" TEXT;
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "referral_source" TEXT;
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "lead_source" TEXT;
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "application_channel" TEXT;
