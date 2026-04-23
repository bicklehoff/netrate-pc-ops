-- Migration 034 — CHECK constraints on categorical columns
--
-- Context:
--   DB structure audit (§4.6, §6.3) surfaced 8 categorical columns with
--   no CHECK constraint. Any value can be written. Pre-flight verified
--   current prod data fits within the canonical vocabularies defined
--   in `src/lib/constants/*.js` and `src/lib/loan-states.js`.
--
--   Adding CHECK constraints prevents future drift — fat-finger typos
--   in INSERT/UPDATE statements fail at the DB layer instead of silently
--   polluting the enum.
--
-- Scope (7 constraints, not 8):
--   loans.status, loans.purpose, loans.ball_in_court
--   leads.status
--   documents.status
--   conditions.status, conditions.stage
--
--   `loan_tasks.status` is DEFERRED — the table is empty (0 rows) and
--   the canonical vocabulary is not yet defined in code. Add CHECK
--   when the first task creation route lands.
--
-- Verified canonical vocabularies (source of truth):
--   loans.status         → src/lib/constants/loan-statuses.js ALL_STATUSES
--   loans.purpose        → legacy 2-value set (purchase/refinance);
--                          scenarios.loan_purpose uses URLA hierarchy
--                          — the two are not yet unified.
--   loans.ball_in_court  → src/lib/loan-states.js BALL_IN_COURT values
--                          + 'none' literal set by pipeline bulk-update.
--   leads.status         → new, contacted, quoted, converted, closed
--                          (all seen in prod + writes in code).
--   documents.status     → src/lib/constants/doc-statuses.js
--                          DOC_STATUS_LABELS keys.
--   conditions.status    → src/lib/constants/conditions.js
--                          CONDITION_STATUSES values.
--   conditions.stage     → src/lib/constants/conditions.js
--                          CONDITION_STAGES values.
--
-- Idempotence:
--   `ADD CONSTRAINT ... CHECK` fails if the constraint name already
--   exists. The DROP CONSTRAINT IF EXISTS guard before each ADD makes
--   this re-runnable — safe for rehearsal replay.
--
-- NOT VALID vs default:
--   Each constraint added with default immediate validation — pre-flight
--   confirmed all existing rows satisfy the canonical values. If any
--   ADD fails at apply time, the migration aborts cleanly (atomic).

BEGIN;

-- loans.status
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_status_check;
ALTER TABLE loans ADD CONSTRAINT loans_status_check CHECK (
  status IN (
    'draft', 'applied', 'processing', 'submitted_uw',
    'cond_approved', 'suspended', 'ctc', 'docs_out',
    'funded', 'settled', 'withdrawn', 'denied', 'archived'
  )
);

-- loans.purpose  (legacy 2-value set — NULL allowed for unmigrated rows)
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_purpose_check;
ALTER TABLE loans ADD CONSTRAINT loans_purpose_check CHECK (
  purpose IS NULL OR purpose IN ('purchase', 'refinance')
);

-- loans.ball_in_court  (NULL allowed for legacy rows never updated)
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_ball_in_court_check;
ALTER TABLE loans ADD CONSTRAINT loans_ball_in_court_check CHECK (
  ball_in_court IS NULL OR ball_in_court IN ('borrower', 'mlo', 'lender', 'none')
);

-- leads.status
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (
  status IN ('new', 'contacted', 'quoted', 'converted', 'closed')
);

-- documents.status
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents ADD CONSTRAINT documents_status_check CHECK (
  status IN ('requested', 'uploaded', 'reviewed', 'accepted', 'rejected')
);

-- conditions.status
ALTER TABLE conditions DROP CONSTRAINT IF EXISTS conditions_status_check;
ALTER TABLE conditions ADD CONSTRAINT conditions_status_check CHECK (
  status IN ('needed', 'received', 'cleared', 'waived')
);

-- conditions.stage
ALTER TABLE conditions DROP CONSTRAINT IF EXISTS conditions_stage_check;
ALTER TABLE conditions ADD CONSTRAINT conditions_stage_check CHECK (
  stage IN (
    'suspense', 'prior_to_docs', 'prior_to_close',
    'at_closing', 'prior_to_fund', 'internal_notes'
  )
);

COMMIT;
