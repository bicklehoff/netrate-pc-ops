-- CreateTable
CREATE TABLE "borrowers" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "dob_encrypted" TEXT NOT NULL,
    "ssn_encrypted" TEXT NOT NULL,
    "ssn_last_four" VARCHAR(4) NOT NULL,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT,
    "magic_token" TEXT,
    "magic_expires" TIMESTAMP(3),
    "sms_code" TEXT,
    "sms_code_expires" TIMESTAMP(3),
    "sms_attempts" INTEGER NOT NULL DEFAULT 0,
    "sms_locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borrowers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mlos" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'mlo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mlos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" UUID NOT NULL,
    "borrower_id" UUID NOT NULL,
    "mlo_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ball_in_court" TEXT NOT NULL DEFAULT 'borrower',
    "purpose" TEXT,
    "occupancy" TEXT,
    "property_address" JSONB,
    "property_type" TEXT,
    "num_units" INTEGER,
    "purchase_price" DECIMAL(12,2),
    "down_payment" DECIMAL(12,2),
    "estimated_value" DECIMAL(12,2),
    "current_balance" DECIMAL(12,2),
    "refi_purpose" TEXT,
    "cash_out_amount" DECIMAL(12,2),
    "current_address" JSONB,
    "address_years" INTEGER,
    "address_months" INTEGER,
    "mailing_address" JSONB,
    "marital_status" TEXT,
    "num_dependents" INTEGER,
    "dependent_ages" TEXT,
    "employment_status" TEXT,
    "employer_name" TEXT,
    "position_title" TEXT,
    "years_in_position" INTEGER,
    "monthly_base_income" DECIMAL(12,2),
    "other_monthly_income" DECIMAL(12,2),
    "other_income_source" TEXT,
    "present_housing_expense" DECIMAL(12,2),
    "declarations" JSONB,
    "application_step" INTEGER NOT NULL DEFAULT 1,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_events" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" UUID,
    "old_value" TEXT,
    "new_value" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "doc_type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "requested_by" UUID,
    "file_url" TEXT,
    "file_name" TEXT,
    "file_size" INTEGER,
    "uploaded_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "borrowers_email_key" ON "borrowers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "mlos_email_key" ON "mlos"("email");

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_mlo_id_fkey" FOREIGN KEY ("mlo_id") REFERENCES "mlos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_events" ADD CONSTRAINT "loan_events_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "mlos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
