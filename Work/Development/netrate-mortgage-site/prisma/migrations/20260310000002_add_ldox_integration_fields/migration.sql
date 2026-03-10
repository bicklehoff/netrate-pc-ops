-- AlterTable — Add LDox integration fields
-- Loan: ldoxLoanId (merge key) + creditScore
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "ldox_loan_id" UUID;
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "credit_score" INTEGER;

-- Unique index on ldox_loan_id for upsert merge key
CREATE UNIQUE INDEX IF NOT EXISTS "loans_ldox_loan_id_key" ON "loans"("ldox_loan_id");

-- Mlo: ldoxOfficerId + NMLS
ALTER TABLE "mlos" ADD COLUMN IF NOT EXISTS "ldox_officer_id" INTEGER;
ALTER TABLE "mlos" ADD COLUMN IF NOT EXISTS "nmls" TEXT;

-- Unique index on ldox_officer_id for MLO matching
CREATE UNIQUE INDEX IF NOT EXISTS "mlos_ldox_officer_id_key" ON "mlos"("ldox_officer_id");
