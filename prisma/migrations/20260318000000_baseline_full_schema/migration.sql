-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

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
    "ldox_officer_id" INTEGER,
    "nmls" TEXT,
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
    "loan_type" TEXT,
    "lender_name" TEXT,
    "loan_number" TEXT,
    "loan_amount" DECIMAL(12,2),
    "interest_rate" DECIMAL(5,4),
    "loan_term" INTEGER,
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
    "num_borrowers" INTEGER NOT NULL DEFAULT 1,
    "work_drive_folder_id" TEXT,
    "work_drive_subfolders" JSONB,
    "cd_work_drive_file_id" TEXT,
    "cd_file_name" TEXT,
    "payroll_sent_at" TIMESTAMP(3),
    "action_taken" TEXT,
    "action_taken_date" TIMESTAMP(3),
    "application_method" TEXT,
    "lien_status" TEXT,
    "referral_source" TEXT,
    "lead_source" TEXT,
    "application_channel" TEXT,
    "ldox_loan_id" UUID,
    "credit_score" INTEGER,
    "application_step" INTEGER NOT NULL DEFAULT 1,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "borrower_id" UUID,
    "zoho_lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_logs" (
    "id" UUID NOT NULL,
    "contact_id" UUID,
    "mlo_id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "from_number" TEXT NOT NULL,
    "to_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'initiated',
    "duration" INTEGER,
    "recording_url" TEXT,
    "twilio_call_sid" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_notes" (
    "id" UUID NOT NULL,
    "call_log_id" UUID NOT NULL,
    "mlo_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "disposition" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_messages" (
    "id" UUID NOT NULL,
    "contact_id" UUID,
    "mlo_id" UUID,
    "direction" TEXT NOT NULL,
    "from_number" TEXT NOT NULL,
    "to_number" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "twilio_message_sid" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "rate_history" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "loan_type" VARCHAR(20) NOT NULL,
    "term" INTEGER NOT NULL,
    "credit_score_tier" VARCHAR(10) NOT NULL,
    "rate" DECIMAL(5,3) NOT NULL,
    "apr" DECIMAL(5,3),
    "points" DECIMAL(4,3),
    "loan_amount" INTEGER,
    "ltv" INTEGER,
    "lender" VARCHAR(100),
    "loan_purpose" VARCHAR(20),
    "property_type" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lenders" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "lender_fees" INTEGER NOT NULL DEFAULT 0,
    "lock_extension" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_sheets" (
    "id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "loan_type" TEXT NOT NULL,
    "term" INTEGER NOT NULL DEFAULT 360,
    "effective_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "llpa_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_rows" (
    "id" UUID NOT NULL,
    "rate_sheet_id" UUID NOT NULL,
    "rate" DECIMAL(5,3) NOT NULL,
    "price_30" DECIMAL(7,4) NOT NULL,
    "price_45" DECIMAL(7,4) NOT NULL,

    CONSTRAINT "rate_rows_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "product" TEXT NOT NULL,
    "ticket_type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_by" TEXT NOT NULL,
    "assigned_to" TEXT,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_entries" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "image_url" TEXT,
    "author_id" TEXT NOT NULL,
    "author_label" TEXT,
    "entry_type" TEXT NOT NULL DEFAULT 'comment',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'website',
    "source_detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "zoho_lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thoughts" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'work',
    "people" TEXT[],
    "topics" TEXT[],
    "confidence" TEXT NOT NULL DEFAULT 'confirmed',
    "superseded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thoughts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "key_decisions" TEXT[],
    "files_modified" TEXT[],
    "open_items" TEXT[],
    "projects" TEXT[],
    "relay_entries" TEXT[],
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "alternatives" TEXT[],
    "category" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "decided_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "superseded_by" TEXT,
    "topics" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relay" (
    "id" TEXT NOT NULL,
    "from_device" TEXT NOT NULL,
    "to_device" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "content" TEXT NOT NULL,
    "context" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_projects" (
    "id" SERIAL NOT NULL,
    "project_id" TEXT NOT NULL,
    "project_name" TEXT NOT NULL,
    "client" TEXT DEFAULT 'NetRate Mortgage',
    "type" TEXT,
    "category" TEXT,
    "state" TEXT,
    "priority" TEXT DEFAULT 'normal',
    "started" TEXT,
    "target_completion" TEXT,
    "actual_completion" TEXT,
    "total_cost" DOUBLE PRECISION DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_goals" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "verification" TEXT,
    "status" TEXT DEFAULT 'not_started',
    "achieved_date" TEXT,
    "evidence" TEXT,

    CONSTRAINT "ops_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_milestones" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "milestone_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT DEFAULT 'pending',
    "reached_date" TEXT,
    "evidence" TEXT,
    "creates" TEXT,
    "sort_order" INTEGER,

    CONSTRAINT "ops_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_instructions" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "instruction_id" TEXT NOT NULL,
    "phase" TEXT,
    "after_milestone_id" INTEGER,
    "until_milestone_id" INTEGER,
    "instruction" TEXT NOT NULL,
    "owner" TEXT DEFAULT 'david',
    "url" TEXT,
    "notes" TEXT,
    "cost" DOUBLE PRECISION,
    "due_date" TEXT,
    "status" TEXT DEFAULT 'active',
    "completed_date" TEXT,
    "repeatable" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" TEXT,
    "surface" TEXT,
    "done_criteria" JSONB,

    CONSTRAINT "ops_instructions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_iterations" (
    "id" SERIAL NOT NULL,
    "instruction_id" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "next_action" TEXT,
    "by_whom" TEXT DEFAULT 'david',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_iterations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_instruction_steps" (
    "id" SERIAL NOT NULL,
    "instruction_id" INTEGER NOT NULL,
    "step_text" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "done_date" TEXT,
    "done_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_instruction_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_ball" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "court" TEXT DEFAULT 'ours',
    "holder" TEXT,
    "since" TEXT,
    "waiting_on" TEXT,
    "next_date" TEXT,
    "cadence_days" INTEGER,
    "method" TEXT,
    "last_follow_up" TEXT,

    CONSTRAINT "ops_ball_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_ball_history" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "court" TEXT NOT NULL,
    "holder" TEXT,
    "waiting_on" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" TEXT DEFAULT 'system',
    "reason" TEXT,

    CONSTRAINT "ops_ball_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_anticipations" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "pre_work" TEXT,
    "status" TEXT DEFAULT 'identified',

    CONSTRAINT "ops_anticipations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_blockers" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "blocker_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "blocking" TEXT,
    "waiting_on" TEXT,
    "raised_date" TEXT NOT NULL,
    "resolved_date" TEXT,
    "resolution" TEXT,

    CONSTRAINT "ops_blockers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_decisions" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "decision_id" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "decided_by" TEXT,
    "context" TEXT,
    "alternatives_rejected" TEXT,
    "affects" TEXT,

    CONSTRAINT "ops_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_documents" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER,
    "doc_id" INTEGER,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "file_path" TEXT,
    "url" TEXT,
    "date_added" TEXT,
    "notes" TEXT,
    "scan_status" TEXT,
    "extracted_data" TEXT,

    CONSTRAINT "ops_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_contacts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "organization" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_timeline" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "source" TEXT DEFAULT 'system',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_draft_emails" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER,
    "instruction_id" INTEGER,
    "to_addr" TEXT,
    "cc_addr" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "attachments" JSONB,
    "status" TEXT DEFAULT 'draft',
    "sent_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_draft_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_tickets" (
    "id" SERIAL NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "created" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "page" TEXT,
    "project_id" TEXT,
    "instruction_id" TEXT,
    "item_text" TEXT,
    "context_type" TEXT,
    "context_json" TEXT,

    CONSTRAINT "ops_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_ticket_entries" (
    "id" SERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "sender" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,

    CONSTRAINT "ops_ticket_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_dev_backlog_items" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'feature',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_by" TEXT NOT NULL DEFAULT 'david',
    "assigned_to" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_dev_backlog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_dev_backlog_comments" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "author" TEXT NOT NULL DEFAULT 'david',
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_dev_backlog_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_project_contacts" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "role_in_project" TEXT,

    CONSTRAINT "ops_project_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_instruction_contacts" (
    "id" SERIAL NOT NULL,
    "instruction_id" INTEGER NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "relationship" TEXT,

    CONSTRAINT "ops_instruction_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_instruction_documents" (
    "id" SERIAL NOT NULL,
    "instruction_id" INTEGER NOT NULL,
    "document_id" INTEGER NOT NULL,
    "relationship" TEXT DEFAULT 'produced',

    CONSTRAINT "ops_instruction_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_blocker_milestones" (
    "id" SERIAL NOT NULL,
    "blocker_id" INTEGER NOT NULL,
    "milestone_id" INTEGER NOT NULL,

    CONSTRAINT "ops_blocker_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_project_dependencies" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "depends_on_id" INTEGER NOT NULL,
    "description" TEXT,
    "status" TEXT DEFAULT 'active',

    CONSTRAINT "ops_project_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_loan_officers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nmls" TEXT,
    "email" TEXT,
    "split_pct" DECIMAL(5,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_loan_officers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_funded_loans" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "borrower_name" TEXT NOT NULL,
    "borrower_last" TEXT NOT NULL,
    "loan_number" TEXT,
    "property_address" TEXT,
    "property_state" TEXT,
    "lender" TEXT,
    "lien_type" TEXT,
    "loan_purpose" TEXT,
    "loan_type" TEXT,
    "loan_amount" DECIMAL(12,2) NOT NULL,
    "interest_rate" DECIMAL(5,4),
    "loan_term" INTEGER,
    "gross_comp" DECIMAL(10,2) NOT NULL,
    "broker_fee" DECIMAL(10,2) NOT NULL,
    "house_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "fees_offset" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "processing_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cost_to_cure" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "appraisal_reimb" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "credit_reimb" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "misc_reimb" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lender_credits" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "wire_total" DECIMAL(10,2) NOT NULL,
    "actual_wire_total" DECIMAL(10,2),
    "lo_id" INTEGER,
    "lo_name" TEXT,
    "lo_nmls" TEXT,
    "lo_split_pct" DECIMAL(5,4),
    "lo_comp_amount" DECIMAL(10,2),
    "lo_net_payable" DECIMAL(10,2),
    "net_to_company" DECIMAL(10,2),
    "closing_date" TIMESTAMP(3),
    "funding_date" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "cd_number" TEXT,
    "cd_file_path" TEXT,
    "cd_extracted_raw" JSONB,
    "quarter" TEXT,
    "mcr_match_id" TEXT,
    "zoho_invoice_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_funded_loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_wire_emails" (
    "id" SERIAL NOT NULL,
    "email_message_id" TEXT NOT NULL,
    "sender_email" TEXT,
    "subject" TEXT,
    "received_at" TIMESTAMP(3),
    "email_body_text" TEXT,
    "wire_amount" DECIMAL(12,2),
    "wire_date" TEXT,
    "wire_reference" TEXT,
    "parsed_borrower" TEXT,
    "parsed_property" TEXT,
    "parsed_originator" TEXT,
    "cd_file_path" TEXT,
    "cd_extracted_raw" TEXT,
    "funded_loan_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_wire_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_compliance_rules" (
    "id" TEXT NOT NULL,
    "section" TEXT,
    "rule_text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "citation" TEXT,
    "scope" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "broker_relevant" BOOLEAN NOT NULL DEFAULT true,
    "thresholds" JSONB NOT NULL DEFAULT '{}',
    "forms_referenced" TEXT[],
    "source_document" TEXT,
    "netrate_notes" TEXT,
    "netrate_status" TEXT NOT NULL DEFAULT 'active',
    "triage_note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by" TEXT NOT NULL DEFAULT 'claw',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_compliance_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "borrowers_email_key" ON "borrowers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "mlos_email_key" ON "mlos"("email");

-- CreateIndex
CREATE UNIQUE INDEX "mlos_ldox_officer_id_key" ON "mlos"("ldox_officer_id");

-- CreateIndex
CREATE UNIQUE INDEX "loans_ldox_loan_id_key" ON "loans"("ldox_loan_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_borrowers_loan_id_borrower_id_key" ON "loan_borrowers"("loan_id", "borrower_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_borrowers_loan_id_ordinal_key" ON "loan_borrowers"("loan_id", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_borrower_id_key" ON "contacts"("borrower_id");

-- CreateIndex
CREATE INDEX "contacts_phone_idx" ON "contacts"("phone");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "call_logs_twilio_call_sid_key" ON "call_logs"("twilio_call_sid");

-- CreateIndex
CREATE INDEX "call_logs_contact_id_idx" ON "call_logs"("contact_id");

-- CreateIndex
CREATE INDEX "call_logs_mlo_id_idx" ON "call_logs"("mlo_id");

-- CreateIndex
CREATE INDEX "call_logs_twilio_call_sid_idx" ON "call_logs"("twilio_call_sid");

-- CreateIndex
CREATE UNIQUE INDEX "sms_messages_twilio_message_sid_key" ON "sms_messages"("twilio_message_sid");

-- CreateIndex
CREATE INDEX "sms_messages_contact_id_idx" ON "sms_messages"("contact_id");

-- CreateIndex
CREATE INDEX "sms_messages_twilio_message_sid_idx" ON "sms_messages"("twilio_message_sid");

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
CREATE INDEX "idx_rate_history_lookup" ON "rate_history"("date", "loan_type", "credit_score_tier");

-- CreateIndex
CREATE UNIQUE INDEX "lenders_code_key" ON "lenders"("code");

-- CreateIndex
CREATE INDEX "rate_sheets_loan_type_status_idx" ON "rate_sheets"("loan_type", "status");

-- CreateIndex
CREATE INDEX "rate_sheets_lender_id_loan_type_status_idx" ON "rate_sheets"("lender_id", "loan_type", "status");

-- CreateIndex
CREATE INDEX "rate_rows_rate_sheet_id_idx" ON "rate_rows"("rate_sheet_id");

-- CreateIndex
CREATE INDEX "hecm_scenarios_mlo_id_idx" ON "hecm_scenarios"("mlo_id");

-- CreateIndex
CREATE INDEX "tickets_product_status_idx" ON "tickets"("product", "status");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_priority_status_idx" ON "tickets"("priority", "status");

-- CreateIndex
CREATE INDEX "ticket_entries_ticket_id_idx" ON "ticket_entries"("ticket_id");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "thoughts_source_idx" ON "thoughts"("source");

-- CreateIndex
CREATE INDEX "thoughts_category_idx" ON "thoughts"("category");

-- CreateIndex
CREATE INDEX "thoughts_domain_idx" ON "thoughts"("domain");

-- CreateIndex
CREATE INDEX "sessions_device_idx" ON "sessions"("device");

-- CreateIndex
CREATE INDEX "sessions_department_idx" ON "sessions"("department");

-- CreateIndex
CREATE INDEX "sessions_started_at_idx" ON "sessions"("started_at");

-- CreateIndex
CREATE INDEX "decisions_category_idx" ON "decisions"("category");

-- CreateIndex
CREATE INDEX "decisions_scope_idx" ON "decisions"("scope");

-- CreateIndex
CREATE INDEX "decisions_status_idx" ON "decisions"("status");

-- CreateIndex
CREATE INDEX "relay_to_device_status_idx" ON "relay"("to_device", "status");

-- CreateIndex
CREATE INDEX "relay_from_device_idx" ON "relay"("from_device");

-- CreateIndex
CREATE INDEX "relay_status_idx" ON "relay"("status");

-- CreateIndex
CREATE INDEX "relay_created_at_idx" ON "relay"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ops_projects_project_id_key" ON "ops_projects"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "ops_goals_project_id_key" ON "ops_goals"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "ops_milestones_project_id_milestone_id_key" ON "ops_milestones"("project_id", "milestone_id");

-- CreateIndex
CREATE UNIQUE INDEX "ops_instructions_project_id_instruction_id_key" ON "ops_instructions"("project_id", "instruction_id");

-- CreateIndex
CREATE UNIQUE INDEX "ops_ball_project_id_key" ON "ops_ball"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "ops_blockers_project_id_blocker_id_key" ON "ops_blockers"("project_id", "blocker_id");

-- CreateIndex
CREATE UNIQUE INDEX "ops_decisions_project_id_decision_id_key" ON "ops_decisions"("project_id", "decision_id");

-- CreateIndex
CREATE UNIQUE INDEX "ops_tickets_ticket_id_key" ON "ops_tickets"("ticket_id");

-- CreateIndex
CREATE INDEX "ops_dev_backlog_items_status_idx" ON "ops_dev_backlog_items"("status");

-- CreateIndex
CREATE INDEX "ops_dev_backlog_items_type_idx" ON "ops_dev_backlog_items"("type");

-- CreateIndex
CREATE INDEX "ops_dev_backlog_items_priority_idx" ON "ops_dev_backlog_items"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "ops_project_contacts_project_id_contact_id_key" ON "ops_project_contacts"("project_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "ops_instruction_contacts_instruction_id_contact_id_key" ON "ops_instruction_contacts"("instruction_id", "contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "ops_instruction_documents_instruction_id_document_id_key" ON "ops_instruction_documents"("instruction_id", "document_id");

-- CreateIndex
CREATE UNIQUE INDEX "ops_blocker_milestones_blocker_id_milestone_id_key" ON "ops_blocker_milestones"("blocker_id", "milestone_id");

-- CreateIndex
CREATE UNIQUE INDEX "ops_project_dependencies_project_id_depends_on_id_key" ON "ops_project_dependencies"("project_id", "depends_on_id");

-- CreateIndex
CREATE INDEX "pay_funded_loans_status_idx" ON "pay_funded_loans"("status");

-- CreateIndex
CREATE INDEX "pay_funded_loans_lo_id_idx" ON "pay_funded_loans"("lo_id");

-- CreateIndex
CREATE INDEX "pay_funded_loans_funding_date_idx" ON "pay_funded_loans"("funding_date");

-- CreateIndex
CREATE INDEX "pay_funded_loans_quarter_idx" ON "pay_funded_loans"("quarter");

-- CreateIndex
CREATE INDEX "pay_funded_loans_borrower_last_idx" ON "pay_funded_loans"("borrower_last");

-- CreateIndex
CREATE UNIQUE INDEX "pay_wire_emails_email_message_id_key" ON "pay_wire_emails"("email_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "pay_wire_emails_funded_loan_id_key" ON "pay_wire_emails"("funded_loan_id");

-- CreateIndex
CREATE INDEX "pay_wire_emails_status_idx" ON "pay_wire_emails"("status");

-- CreateIndex
CREATE INDEX "pay_wire_emails_wire_amount_idx" ON "pay_wire_emails"("wire_amount");

-- CreateIndex
CREATE INDEX "ops_compliance_rules_category_idx" ON "ops_compliance_rules"("category");

-- CreateIndex
CREATE INDEX "ops_compliance_rules_scope_idx" ON "ops_compliance_rules"("scope");

-- CreateIndex
CREATE INDEX "ops_compliance_rules_status_idx" ON "ops_compliance_rules"("status");

-- CreateIndex
CREATE INDEX "ops_compliance_rules_severity_idx" ON "ops_compliance_rules"("severity");

-- CreateIndex
CREATE INDEX "ops_compliance_rules_netrate_status_idx" ON "ops_compliance_rules"("netrate_status");

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_mlo_id_fkey" FOREIGN KEY ("mlo_id") REFERENCES "mlos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_borrowers" ADD CONSTRAINT "loan_borrowers_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_borrowers" ADD CONSTRAINT "loan_borrowers_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_events" ADD CONSTRAINT "loan_events_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "mlos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_mlo_id_fkey" FOREIGN KEY ("mlo_id") REFERENCES "mlos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_notes" ADD CONSTRAINT "call_notes_call_log_id_fkey" FOREIGN KEY ("call_log_id") REFERENCES "call_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_notes" ADD CONSTRAINT "call_notes_mlo_id_fkey" FOREIGN KEY ("mlo_id") REFERENCES "mlos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_mlo_id_fkey" FOREIGN KEY ("mlo_id") REFERENCES "mlos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "rate_sheets" ADD CONSTRAINT "rate_sheets_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "lenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_rows" ADD CONSTRAINT "rate_rows_rate_sheet_id_fkey" FOREIGN KEY ("rate_sheet_id") REFERENCES "rate_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hecm_scenarios" ADD CONSTRAINT "hecm_scenarios_mlo_id_fkey" FOREIGN KEY ("mlo_id") REFERENCES "mlos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_entries" ADD CONSTRAINT "ticket_entries_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_goals" ADD CONSTRAINT "ops_goals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ops_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_milestones" ADD CONSTRAINT "ops_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ops_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_instructions" ADD CONSTRAINT "ops_instructions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ops_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_instructions" ADD CONSTRAINT "ops_instructions_after_milestone_id_fkey" FOREIGN KEY ("after_milestone_id") REFERENCES "ops_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_instructions" ADD CONSTRAINT "ops_instructions_until_milestone_id_fkey" FOREIGN KEY ("until_milestone_id") REFERENCES "ops_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_iterations" ADD CONSTRAINT "ops_iterations_instruction_id_fkey" FOREIGN KEY ("instruction_id") REFERENCES "ops_instructions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_instruction_steps" ADD CONSTRAINT "ops_instruction_steps_instruction_id_fkey" FOREIGN KEY ("instruction_id") REFERENCES "ops_instructions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_ball" ADD CONSTRAINT "ops_ball_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ops_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_ball_history" ADD CONSTRAINT "ops_ball_history_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ops_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_anticipations" ADD CONSTRAINT "ops_anticipations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ops_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_blockers" ADD CONSTRAINT "ops_blockers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ops_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_decisions" ADD CONSTRAINT "ops_decisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ops_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_documents" ADD CONSTRAINT "ops_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ops_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_timeline" ADD CONSTRAINT "ops_timeline_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ops_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_draft_emails" ADD CONSTRAINT "ops_draft_emails_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ops_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_draft_emails" ADD CONSTRAINT "ops_draft_emails_instruction_id_fkey" FOREIGN KEY ("instruction_id") REFERENCES "ops_instructions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_ticket_entries" ADD CONSTRAINT "ops_ticket_entries_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ops_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_dev_backlog_comments" ADD CONSTRAINT "ops_dev_backlog_comments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "ops_dev_backlog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_project_contacts" ADD CONSTRAINT "ops_project_contacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ops_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_project_contacts" ADD CONSTRAINT "ops_project_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "ops_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_instruction_contacts" ADD CONSTRAINT "ops_instruction_contacts_instruction_id_fkey" FOREIGN KEY ("instruction_id") REFERENCES "ops_instructions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_instruction_contacts" ADD CONSTRAINT "ops_instruction_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "ops_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_instruction_documents" ADD CONSTRAINT "ops_instruction_documents_instruction_id_fkey" FOREIGN KEY ("instruction_id") REFERENCES "ops_instructions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_instruction_documents" ADD CONSTRAINT "ops_instruction_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "ops_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_blocker_milestones" ADD CONSTRAINT "ops_blocker_milestones_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "ops_blockers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_blocker_milestones" ADD CONSTRAINT "ops_blocker_milestones_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "ops_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_project_dependencies" ADD CONSTRAINT "ops_project_dependencies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "ops_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_project_dependencies" ADD CONSTRAINT "ops_project_dependencies_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "ops_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_funded_loans" ADD CONSTRAINT "pay_funded_loans_lo_id_fkey" FOREIGN KEY ("lo_id") REFERENCES "pay_loan_officers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_wire_emails" ADD CONSTRAINT "pay_wire_emails_funded_loan_id_fkey" FOREIGN KEY ("funded_loan_id") REFERENCES "pay_funded_loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

