-- AlterTable: Add universal fields to loans
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "account_exec" TEXT,
ADD COLUMN IF NOT EXISTS "appraised_value" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "broker_processor" TEXT,
ADD COLUMN IF NOT EXISTS "loan_program" TEXT,
ADD COLUMN IF NOT EXISTS "underwriter_name" TEXT;

-- AlterTable: Add new fields to conditions
ALTER TABLE "conditions" ADD COLUMN IF NOT EXISTS "cleared_at" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "condition_number" INTEGER,
ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMPTZ(6);

-- CreateTable: loan_fha (FHA-specific fields)
CREATE TABLE IF NOT EXISTS "loan_fha" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "case_number" TEXT,
    "case_assigned_date" TIMESTAMP(3),
    "ufmip" DECIMAL(12,2),
    "monthly_mip" DECIMAL(12,2),
    "mip_percent" DECIMAL(5,4),
    "financial_assessment_result" TEXT,
    "lesa_result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "loan_fha_pkey" PRIMARY KEY ("id")
);

-- CreateTable: loan_hecm (HECM reverse mortgage fields)
CREATE TABLE IF NOT EXISTS "loan_hecm" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "margin" DECIMAL(5,4),
    "max_claim_amount" DECIMAL(12,2),
    "principal_limit" DECIMAL(12,2),
    "initial_interest_rate_index" DECIMAL(5,4),
    "initial_interest_rate" DECIMAL(5,4),
    "expected_interest_rate" DECIMAL(5,4),
    "lifetime_cap" DECIMAL(5,4),
    "pll_expiration" TIMESTAMP(3),
    "counseling_expiration" TIMESTAMP(3),
    "counseling_date" TIMESTAMP(3),
    "payment_plan" TEXT,
    "loc_limit" DECIMAL(12,2),
    "loc_growth_rate" DECIMAL(5,4),
    "mandatory_obligations" DECIMAL(12,2),
    "cash_available_at_closing" DECIMAL(12,2),
    "plu_percent" DECIMAL(5,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "loan_hecm_pkey" PRIMARY KEY ("id")
);

-- CreateTable: loan_va (VA loan fields)
CREATE TABLE IF NOT EXISTS "loan_va" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "entitlement_amount" DECIMAL(12,2),
    "funding_fee" DECIMAL(12,2),
    "funding_fee_exempt" BOOLEAN NOT NULL DEFAULT false,
    "certificate_of_eligibility" TEXT,
    "service_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "loan_va_pkey" PRIMARY KEY ("id")
);

-- CreateTable: loan_dscr (DSCR investor loan fields)
CREATE TABLE IF NOT EXISTS "loan_dscr" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "dscr_ratio" DECIMAL(5,3),
    "ppp_term" INTEGER,
    "interest_only" BOOLEAN NOT NULL DEFAULT false,
    "interest_only_term" INTEGER,
    "prepay_penalty_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "loan_dscr_pkey" PRIMARY KEY ("id")
);

-- CreateTable: loan_conv (Conventional loan fields)
CREATE TABLE IF NOT EXISTS "loan_conv" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "pmi_required" BOOLEAN NOT NULL DEFAULT false,
    "pmi_monthly" DECIMAL(12,2),
    "pmi_removal_ltv" DECIMAL(5,4),
    "pmi_company" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "loan_conv_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "loan_fha_loan_id_key" ON "loan_fha"("loan_id");
CREATE UNIQUE INDEX IF NOT EXISTS "loan_hecm_loan_id_key" ON "loan_hecm"("loan_id");
CREATE UNIQUE INDEX IF NOT EXISTS "loan_va_loan_id_key" ON "loan_va"("loan_id");
CREATE UNIQUE INDEX IF NOT EXISTS "loan_dscr_loan_id_key" ON "loan_dscr"("loan_id");
CREATE UNIQUE INDEX IF NOT EXISTS "loan_conv_loan_id_key" ON "loan_conv"("loan_id");

-- AddForeignKey
ALTER TABLE "loan_fha" ADD CONSTRAINT "loan_fha_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loan_hecm" ADD CONSTRAINT "loan_hecm_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loan_va" ADD CONSTRAINT "loan_va_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loan_dscr" ADD CONSTRAINT "loan_dscr_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loan_conv" ADD CONSTRAINT "loan_conv_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data fix: normalize condition stage values
UPDATE "conditions" SET stage = 'prior_to_fund' WHERE stage = 'prior_to_funding';
