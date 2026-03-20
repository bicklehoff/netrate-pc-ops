-- CreateTable: market_summaries
-- Daily market commentary pushed by OpenClaw agent, displayed on /rate-watch

CREATE TABLE "market_summaries" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "treasury_10yr" DECIMAL(5,3),
    "treasury_10yr_chg" DECIMAL(5,3),
    "mbs_6_coupon" VARCHAR(20),
    "mbs_6_change" DECIMAL(5,3),
    "headline" VARCHAR(200) NOT NULL,
    "commentary" TEXT NOT NULL,
    "sentiment" VARCHAR(20) NOT NULL DEFAULT 'neutral',
    "upcoming_events" JSONB,
    "created_by" VARCHAR(50) NOT NULL DEFAULT 'claw',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "market_summaries_date_key" ON "market_summaries"("date");
CREATE INDEX "idx_market_summaries_date" ON "market_summaries"("date");
