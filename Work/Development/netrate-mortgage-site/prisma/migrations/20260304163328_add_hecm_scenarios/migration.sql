-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "interest_rate" DECIMAL(5,4),
ADD COLUMN     "lender_name" TEXT,
ADD COLUMN     "loan_amount" DECIMAL(12,2),
ADD COLUMN     "loan_number" TEXT,
ADD COLUMN     "loan_term" INTEGER,
ADD COLUMN     "loan_type" TEXT,
ADD COLUMN     "num_borrowers" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "loan_borrowers" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "borrower_id" UUID NOT NULL,
    "borrower_type" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "relationship" TEXT,
    "marital_status" TEXT,
    "current_address" JSONB,
    "address_years" INTEGER,
    "address_months" INTEGER,
    "mailing_address" JSONB,
    "employment_status" TEXT,
    "employer_name" TEXT,
    "position_title" TEXT,
    "years_in_position" INTEGER,
    "monthly_base_income" DECIMAL(12,2),
    "other_monthly_income" DECIMAL(12,2),
    "other_income_source" TEXT,
    "declarations" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_borrowers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_dates" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "application_date" TIMESTAMP(3),
    "locked_date" TIMESTAMP(3),
    "lock_expiration" TIMESTAMP(3),
    "lock_term" INTEGER,
    "credit_pulled_date" TIMESTAMP(3),
    "credit_expiration" TIMESTAMP(3),
    "appraisal_ordered" TIMESTAMP(3),
    "appraisal_scheduled" TIMESTAMP(3),
    "appraisal_received" TIMESTAMP(3),
    "appraisal_due" TIMESTAMP(3),
    "appraisal_deadline" TIMESTAMP(3),
    "appraisal_expiry" TIMESTAMP(3),
    "appraisal_waiver" BOOLEAN NOT NULL DEFAULT false,
    "title_ordered" TIMESTAMP(3),
    "title_received" TIMESTAMP(3),
    "title_expiry" TIMESTAMP(3),
    "hoi_ordered" TIMESTAMP(3),
    "hoi_received" TIMESTAMP(3),
    "hoi_bound" TIMESTAMP(3),
    "flood_cert_ordered" TIMESTAMP(3),
    "flood_cert_received" TIMESTAMP(3),
    "estimated_closing" TIMESTAMP(3),
    "closing_date" TIMESTAMP(3),
    "estimated_funding" TIMESTAMP(3),
    "funding_date" TIMESTAMP(3),
    "first_payment_date" TIMESTAMP(3),
    "submitted_to_uw_date" TIMESTAMP(3),
    "cond_approved_date" TIMESTAMP(3),
    "ctc_date" TIMESTAMP(3),
    "docs_out_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditions" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "condition_type" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'prior_to_docs',
    "status" TEXT NOT NULL DEFAULT 'needed',
    "owner_role" TEXT,
    "assigned_to_id" UUID,
    "requested_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "borrower_facing" BOOLEAN NOT NULL DEFAULT false,
    "blocking_progress" BOOLEAN NOT NULL DEFAULT false,
    "internal_notes" JSONB,
    "file_url" TEXT,
    "file_name" TEXT,
    "document_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_notes" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "author_type" TEXT NOT NULL,
    "source" TEXT,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_tasks" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'later',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "due_date" TIMESTAMP(3),
    "assigned_to_id" UUID,
    "created_by_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hecm_scenarios" (
    "id" UUID NOT NULL,
    "mlo_id" UUID NOT NULL,
    "borrower_name" TEXT NOT NULL,
    "reference_number" TEXT,
    "home_value" DECIMAL(12,2),
    "input_state" JSONB NOT NULL,
    "results" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hecm_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loan_borrowers_loan_id_borrower_id_key" ON "loan_borrowers"("loan_id", "borrower_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_borrowers_loan_id_ordinal_key" ON "loan_borrowers"("loan_id", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "loan_dates_loan_id_key" ON "loan_dates"("loan_id");

-- CreateIndex
CREATE INDEX "conditions_loan_id_idx" ON "conditions"("loan_id");

-- CreateIndex
CREATE INDEX "conditions_loan_id_status_idx" ON "conditions"("loan_id", "status");

-- CreateIndex
CREATE INDEX "loan_notes_loan_id_idx" ON "loan_notes"("loan_id");

-- CreateIndex
CREATE INDEX "loan_tasks_loan_id_idx" ON "loan_tasks"("loan_id");

-- CreateIndex
CREATE INDEX "loan_tasks_assigned_to_id_status_idx" ON "loan_tasks"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "hecm_scenarios_mlo_id_idx" ON "hecm_scenarios"("mlo_id");

-- AddForeignKey
ALTER TABLE "loan_borrowers" ADD CONSTRAINT "loan_borrowers_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_borrowers" ADD CONSTRAINT "loan_borrowers_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_dates" ADD CONSTRAINT "loan_dates_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_notes" ADD CONSTRAINT "loan_notes_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_tasks" ADD CONSTRAINT "loan_tasks_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hecm_scenarios" ADD CONSTRAINT "hecm_scenarios_mlo_id_fkey" FOREIGN KEY ("mlo_id") REFERENCES "mlos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
