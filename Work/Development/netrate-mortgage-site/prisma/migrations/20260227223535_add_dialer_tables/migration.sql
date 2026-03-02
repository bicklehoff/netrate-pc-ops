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
