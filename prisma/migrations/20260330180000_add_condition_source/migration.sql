-- Add source field to conditions (manual vs approval-extracted)
ALTER TABLE "conditions" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';
