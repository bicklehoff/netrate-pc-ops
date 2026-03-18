-- Condition Enrichment: Processing Engine Fields
ALTER TABLE "conditions" ADD COLUMN IF NOT EXISTS "freshness_days" INTEGER;
ALTER TABLE "conditions" ADD COLUMN IF NOT EXISTS "last_checked_at" TIMESTAMP(3);
ALTER TABLE "conditions" ADD COLUMN IF NOT EXISTS "chase_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "conditions" ADD COLUMN IF NOT EXISTS "last_chased_at" TIMESTAMP(3);
ALTER TABLE "conditions" ADD COLUMN IF NOT EXISTS "next_chase_at" TIMESTAMP(3);
ALTER TABLE "conditions" ADD COLUMN IF NOT EXISTS "depends_on_id" UUID;
ALTER TABLE "conditions" ADD COLUMN IF NOT EXISTS "borrower_message" TEXT;

-- Self-referencing FK: condition dependency chain
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_depends_on_id_fkey"
  FOREIGN KEY ("depends_on_id") REFERENCES "conditions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for engine to find conditions due for chase
CREATE INDEX IF NOT EXISTS "conditions_next_chase_at_idx" ON "conditions"("next_chase_at");

-- LoanContact: Per-loan vendor contacts
CREATE TABLE IF NOT EXISTS "loan_contacts" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_contacts_pkey" PRIMARY KEY ("id")
);

-- LoanContact indexes
CREATE INDEX IF NOT EXISTS "loan_contacts_loan_id_idx" ON "loan_contacts"("loan_id");
CREATE INDEX IF NOT EXISTS "loan_contacts_loan_id_role_idx" ON "loan_contacts"("loan_id", "role");

-- LoanContact FK
ALTER TABLE "loan_contacts" ADD CONSTRAINT "loan_contacts_loan_id_fkey"
  FOREIGN KEY ("loan_id") REFERENCES "loans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
