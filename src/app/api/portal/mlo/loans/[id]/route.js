// API: MLO Loan Detail
// GET /api/portal/mlo/loans/:id — Full loan detail with all related data
// PATCH /api/portal/mlo/loans/:id — Update loan status, fields, or add notes
//
// Core UI Redesign: Expanded GET includes dates, conditions, loanBorrowers, tasks.
// Expanded PATCH accepts all editable fields + MCR-aware status→date auto-capture.

import { NextResponse } from 'next/server';
import { enrichPropertyAddress } from '@/lib/geocode';
import sql from '@/lib/db';
import { getBallInCourt, EMAIL_TRIGGERS } from '@/lib/loan-states';
import { sendEmail } from '@/lib/resend';
import { statusChangeTemplate } from '@/lib/email-templates/borrower';
import { checkApplicationGate } from '@/lib/application-gate';
import { updateContactFromLoanStatus } from '@/lib/contact-status';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

// Status → loan_dates column mapping for MCR-aware auto-date capture
const STATUS_DATE_MAP = {
  applied: 'application_date',
  submitted_uw: 'submitted_to_uw_date',
  cond_approved: 'cond_approved_date',
  ctc: 'ctc_date',
  docs_out: 'docs_out_date',
  funded: 'funding_date',
};

// camelCase field → snake_case column mapping for loans table
const FIELD_TO_COLUMN = {
  loanType: 'loan_type', loanAmount: 'loan_amount', interestRate: 'interest_rate',
  loanTerm: 'loan_term', lienStatus: 'lien_status', numBorrowers: 'num_borrowers',
  propertyAddress: 'property_address', propertyType: 'property_type', numUnits: 'num_units',
  purchasePrice: 'purchase_price', downPayment: 'down_payment', estimatedValue: 'estimated_value',
  currentBalance: 'current_balance', refiPurpose: 'refi_purpose', cashOutAmount: 'cash_out_amount',
  lenderName: 'lender_name', loanNumber: 'loan_number',
  employmentStatus: 'employment_status', employerName: 'employer_name',
  positionTitle: 'position_title', yearsInPosition: 'years_in_position',
  monthlyBaseIncome: 'monthly_base_income', otherMonthlyIncome: 'other_monthly_income',
  otherIncomeSource: 'other_income_source', presentHousingExpense: 'present_housing_expense',
  maritalStatus: 'marital_status', numDependents: 'num_dependents', dependentAges: 'dependent_ages',
  creditScore: 'credit_score', actionTaken: 'action_taken', actionTakenDate: 'action_taken_date',
  applicationMethod: 'application_method', referralSource: 'referral_source',
  leadSource: 'lead_source', applicationChannel: 'application_channel',
  prequalLetterData: 'prequal_letter_data', appraisedValue: 'appraised_value',
  loanProgram: 'loan_program', underwriterName: 'underwriter_name',
  accountExec: 'account_exec', brokerProcessor: 'broker_processor',
  amortizationType: 'amortization_type', titleHeldAs: 'title_held_as',
  estateHeldIn: 'estate_held_in', armIndex: 'arm_index', armMargin: 'arm_margin',
  armInitialCap: 'arm_initial_cap', armPeriodicCap: 'arm_periodic_cap',
  armLifetimeCap: 'arm_lifetime_cap', armAdjustmentPeriod: 'arm_adjustment_period',
  // pass-through (already snake_case in DB)
  purpose: 'purpose', occupancy: 'occupancy',
};

// All loan fields that can be updated via inline edit
const EDITABLE_FIELDS = [
  'loanType', 'loanAmount', 'interestRate', 'loanTerm', 'lienStatus', 'numBorrowers',
  'propertyAddress', 'propertyType', 'numUnits', 'purchasePrice', 'downPayment', 'estimatedValue', 'currentBalance',
  'purpose', 'occupancy', 'refiPurpose', 'cashOutAmount',
  'lenderName', 'loanNumber',
  'employmentStatus', 'employerName', 'positionTitle', 'yearsInPosition',
  'monthlyBaseIncome', 'otherMonthlyIncome', 'otherIncomeSource',
  'presentHousingExpense', 'maritalStatus', 'numDependents', 'dependentAges',
  'creditScore',
  'actionTaken', 'actionTakenDate', 'applicationMethod',
  'referralSource', 'leadSource', 'applicationChannel',
  'prequalLetterData',
  'appraisedValue', 'loanProgram', 'underwriterName', 'accountExec', 'brokerProcessor',
  'amortizationType', 'titleHeldAs', 'estateHeldIn',
  'armIndex', 'armMargin', 'armInitialCap', 'armPeriodicCap', 'armLifetimeCap', 'armAdjustmentPeriod',
];

// Fields that need Decimal conversion
const DECIMAL_FIELDS = [
  'loanAmount', 'interestRate', 'purchasePrice', 'downPayment',
  'estimatedValue', 'currentBalance', 'cashOutAmount',
  'monthlyBaseIncome', 'otherMonthlyIncome', 'presentHousingExpense',
  'appraisedValue',
  'armMargin', 'armInitialCap', 'armPeriodicCap', 'armLifetimeCap',
];

// Fields that need Integer conversion
const INT_FIELDS = ['loanTerm', 'numUnits', 'yearsInPosition', 'numBorrowers', 'creditScore', 'numDependents', 'armAdjustmentPeriod'];


export async function GET(request, { params }) {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    // ─── Main loan ───
    const loans = await sql`SELECT * FROM loans WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    const loan = loans[0];
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    // ─── Borrower ───
    const borrowers = loan.borrower_id
      ? await sql`SELECT id, first_name, last_name, email, phone, ssn_last_four, phone_verified, created_at
                   FROM borrowers WHERE id = ${loan.borrower_id} LIMIT 1`
      : [];

    // ─── MLO ───
    const mlos = loan.mlo_id
      ? await sql`SELECT id, first_name, last_name, email FROM staff WHERE id = ${loan.mlo_id} LIMIT 1`
      : [];

    // ─── Documents (with requestedBy) ───
    const documents = await sql`
      SELECT d.*, m.first_name AS requested_by_first_name, m.last_name AS requested_by_last_name
      FROM documents d
      LEFT JOIN staff m ON m.id = d.requested_by
      WHERE d.loan_id = ${id}
      ORDER BY d.created_at DESC
    `;

    // ─── Events (last 50) ───
    const events = await sql`
      SELECT * FROM loan_events WHERE loan_id = ${id} ORDER BY created_at DESC LIMIT 50
    `;

    // ─── Dates ───
    const datesRows = await sql`SELECT * FROM loan_dates WHERE loan_id = ${id} LIMIT 1`;

    // ─── Satellite tables ───
    const fhaRows = await sql`SELECT * FROM loan_fha WHERE loan_id = ${id} LIMIT 1`;
    const hecmRows = await sql`SELECT * FROM loan_hecm WHERE loan_id = ${id} LIMIT 1`;
    const vaRows = await sql`SELECT * FROM loan_va WHERE loan_id = ${id} LIMIT 1`;
    const dscrRows = await sql`SELECT * FROM loan_dscr WHERE loan_id = ${id} LIMIT 1`;
    const convRows = await sql`SELECT * FROM loan_conv WHERE loan_id = ${id} LIMIT 1`;

    // ─── Conditions ───
    const conditions = await sql`
      SELECT * FROM conditions WHERE loan_id = ${id} ORDER BY stage ASC, created_at ASC
    `;

    // ─── LoanBorrowers with sub-models ───
    const loanBorrowers = await sql`
      SELECT lb.*, b.id AS b_id, b.first_name AS b_first_name, b.last_name AS b_last_name, b.email AS b_email, b.phone AS b_phone
      FROM loan_borrowers lb
      LEFT JOIN borrowers b ON b.id = lb.borrower_id
      WHERE lb.loan_id = ${id}
      ORDER BY lb.ordinal ASC
    `;

    // Fetch sub-models per borrower
    const lbIds = loanBorrowers.map(lb => lb.id);
    let employments = [];
    let incomes = [];
    let declarations = [];
    if (lbIds.length > 0) {
      employments = await sql`SELECT * FROM loan_employments WHERE loan_borrower_id = ANY(${lbIds}) ORDER BY is_primary DESC`;
      incomes = await sql`SELECT * FROM loan_incomes WHERE loan_borrower_id = ANY(${lbIds})`;
      declarations = await sql`SELECT * FROM loan_declarations WHERE loan_borrower_id = ANY(${lbIds})`;
    }

    // ─── Assets, Liabilities, REOs, Transaction ───
    const assets = await sql`SELECT * FROM loan_assets WHERE loan_id = ${id} ORDER BY created_at ASC`;
    const liabilities = await sql`SELECT * FROM loan_liabilities WHERE loan_id = ${id} ORDER BY created_at ASC`;
    const reos = await sql`SELECT * FROM loan_reos WHERE loan_id = ${id} ORDER BY created_at ASC`;
    const transactionRows = await sql`SELECT * FROM loan_transactions WHERE loan_id = ${id} LIMIT 1`;

    // ─── Tasks ───
    const tasks = await sql`
      SELECT * FROM loan_tasks WHERE loan_id = ${id} ORDER BY priority ASC, created_at DESC
    `;

    // ─── Assemble response ───
    const LOAN_DECIMAL_FIELDS = [
      'loan_amount', 'interest_rate', 'purchase_price', 'down_payment',
      'estimated_value', 'current_balance', 'cash_out_amount',
      'monthly_base_income', 'other_monthly_income', 'present_housing_expense',
      'appraised_value', 'arm_margin', 'arm_initial_cap', 'arm_periodic_cap', 'arm_lifetime_cap',
      'broker_compensation', 'cash_to_close', 'lender_credits', 'monthly_payment', 'total_closing_costs',
    ];

    const serialized = { ...loan };
    for (const f of LOAN_DECIMAL_FIELDS) {
      if (serialized[f] != null) serialized[f] = Number(serialized[f]);
    }

    // Attach related data
    serialized.borrower = borrowers[0] || null;
    serialized.mlo = mlos[0] || null;
    serialized.documents = documents.map(d => ({
      ...d,
      requested_by: d.requested_by_first_name
        ? { first_name: d.requested_by_first_name, last_name: d.requested_by_last_name }
        : null,
    }));
    serialized.events = events;
    serialized.dates = datesRows[0] || null;
    serialized.fha = fhaRows[0] || null;
    serialized.hecm = hecmRows[0] || null;
    serialized.va = vaRows[0] || null;
    serialized.dscr = dscrRows[0] || null;
    serialized.conv = convRows[0] || null;
    serialized.conditions = conditions;

    // Assemble loanBorrowers with nested sub-models
    serialized.loan_borrowers = loanBorrowers.map(lb => {
      const lbEmployments = employments.filter(e => e.loan_borrower_id === lb.id);
      const lbIncome = incomes.find(i => i.loan_borrower_id === lb.id) || null;
      const lbDeclaration = declarations.find(d => d.loan_borrower_id === lb.id) || null;
      return {
        ...lb,
        monthly_base_income: lb.monthly_base_income ? Number(lb.monthly_base_income) : null,
        other_monthly_income: lb.other_monthly_income ? Number(lb.other_monthly_income) : null,
        monthly_rent: lb.monthly_rent ? Number(lb.monthly_rent) : null,
        borrower: {
          id: lb.b_id, first_name: lb.b_first_name, last_name: lb.b_last_name,
          email: lb.b_email, phone: lb.b_phone,
        },
        employments: lbEmployments,
        income: lbIncome,
        declaration: lbDeclaration,
      };
    });

    serialized.assets = assets;
    serialized.liabilities = liabilities;
    serialized.reos = reos;
    serialized.transaction = transactionRows[0] || null;
    serialized.tasks = tasks;

    return NextResponse.json({ loan: serialized });
  } catch (error) {
    console.error('Loan detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await request.json();
    const isAdmin = session.user.role === 'admin';

    const loans = await sql`SELECT * FROM loans WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    const loan = loans[0];
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }
    if (!isAdmin && loan.mlo_id !== mloId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // ─── Handle status change (with MCR-aware date auto-capture) ───
    if (body.status && body.status !== loan.status) {
      const pendingRows = await sql`
        SELECT COUNT(*)::int AS total FROM documents WHERE loan_id = ${id} AND status = 'requested'
      `;
      const pendingDocs = pendingRows[0].total;

      const updatedRows = await sql`
        UPDATE loans SET status = ${body.status}, ball_in_court = ${getBallInCourt(body.status, pendingDocs > 0) || 'none'}, updated_at = NOW()
        WHERE id = ${id} RETURNING *
      `;
      const updated = updatedRows[0];

      // Create audit event
      await sql`
        INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, old_value, new_value, created_at)
        VALUES (gen_random_uuid(), ${id}, 'status_change', 'mlo', ${mloId}, ${loan.status}, ${body.status}, NOW())
      `;

      // MCR-aware: auto-capture date on loan_dates when status changes
      const dateCol = STATUS_DATE_MAP[body.status];
      if (dateCol) {
        // Check if date already exists
        const existingDates = await sql`SELECT * FROM loan_dates WHERE loan_id = ${id} LIMIT 1`;
        if (existingDates.length === 0) {
          // Create with the date
          await sql`
            INSERT INTO loan_dates (id, loan_id, ${sql.identifier([dateCol])}, created_at, updated_at)
            VALUES (gen_random_uuid(), ${id}, NOW(), NOW(), NOW())
          `;
        } else if (!existingDates[0][dateCol]) {
          // Only set if not already set
          await sql`
            UPDATE loan_dates SET ${sql.identifier([dateCol])} = NOW(), updated_at = NOW() WHERE loan_id = ${id}
          `;
        }
      }

      // Send borrower notification email (non-blocking)
      const trigger = EMAIL_TRIGGERS[body.status];
      if (trigger?.sendToBorrower && loan.borrower_id) {
        const borrowerRows = await sql`SELECT * FROM borrowers WHERE id = ${loan.borrower_id} LIMIT 1`;
        const borrower = borrowerRows[0];
        if (borrower?.email) {
          const template = statusChangeTemplate({
            firstName: borrower.first_name,
            status: body.status,
            loanId: id,
            propertyAddress: loan.property_address?.street,
          });
          if (template) {
            sendEmail({ to: borrower.email, ...template }).catch((err) => {
              console.error(`Status email failed (${body.status}):`, err.message);
            });
          }
        }
      }

      // Update contact lifecycle status (non-blocking)
      updateContactFromLoanStatus(loan.id, body.status).catch(() => {});

      return NextResponse.json({ loan: updated });
    }

    // ─── Handle note addition ───
    if (body.note) {
      await sql`
        INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, created_at)
        VALUES (gen_random_uuid(), ${id}, 'note_added', 'mlo', ${mloId}, ${body.note}, NOW())
      `;

      return NextResponse.json({ success: true });
    }

    // ─── Handle MLO assignment ───
    if (body.mloId !== undefined) {
      const updatedRows = await sql`
        UPDATE loans SET mlo_id = ${body.mloId}, updated_at = NOW() WHERE id = ${id} RETURNING *
      `;

      await sql`
        INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, old_value, new_value, details, created_at)
        VALUES (gen_random_uuid(), ${id}, 'field_updated', 'mlo', ${mloId}, ${loan.mlo_id}, ${body.mloId}, ${JSON.stringify({ field: 'mloId' })}, NOW())
      `;

      return NextResponse.json({ loan: updatedRows[0] });
    }

    // ─── Handle inline field updates (expanded for Core UI) ───
    const setClauses = [];
    const setValues = [];
    const fieldDetails = {};

    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) {
        let value = body[field];

        // Type coerce
        if (value === '' || value === null) {
          value = null;
        } else if (DECIMAL_FIELDS.includes(field)) {
          value = parseFloat(value);
          if (isNaN(value)) value = null;
        } else if (INT_FIELDS.includes(field)) {
          value = parseInt(value, 10);
          if (isNaN(value)) value = null;
        } else if (field === 'actionTakenDate') {
          value = value ? new Date(value) : null;
        } else if (field === 'propertyAddress') {
          if (typeof value === 'string') {
            const parts = value.split(',').map((s) => s.trim());
            value = { street: parts[0] || '', city: parts[1] || '', state: parts[2] || '', zip: parts[3] || '' };
          }
        }

        const col = FIELD_TO_COLUMN[field] || field;
        setClauses.push(col);
        setValues.push(value);
        fieldDetails[field] = { old: loan[col], new: value };
      }
    }

    if (setClauses.length > 0) {
      // Build dynamic UPDATE — use parameterized approach
      // Neon tagged template doesn't support fully dynamic column lists easily,
      // so we build a raw SQL string with proper escaping
      const setFragments = setClauses.map((col, i) => `"${col}" = $${i + 1}`);
      const paramIndex = setClauses.length + 1;
      const query = `UPDATE loans SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;
      const allParams = [...setValues.map(v => v === undefined ? null : (typeof v === 'object' && v !== null && !(v instanceof Date) ? JSON.stringify(v) : v)), id];

      // Use sql.query for raw parameterized query
      const updatedRows = await sql(query, allParams);
      const updated = updatedRows[0];

      // Build fieldUpdates JSON for audit
      const fieldUpdates = {};
      setClauses.forEach((col, i) => { fieldUpdates[col] = setValues[i]; });

      await sql`
        INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
        VALUES (gen_random_uuid(), ${id}, 'field_updated', 'mlo', ${mloId},
                ${JSON.stringify(fieldUpdates)},
                ${JSON.stringify({ fields: fieldDetails, source: 'core_inline_edit' })},
                NOW())
      `;

      // Auto-geocode if propertyAddress changed (non-blocking)
      const propAddrIdx = setClauses.indexOf('property_address');
      if (propAddrIdx !== -1 && setValues[propAddrIdx]?.street) {
        enrichPropertyAddress(setValues[propAddrIdx]).then(async (result) => {
          if (result.enriched) {
            await sql`UPDATE loans SET property_address = ${JSON.stringify(result.address)}, updated_at = NOW() WHERE id = ${id}`.catch(() => {});
          }
        }).catch(() => {});
      }

      // Application gate — check if loan just became a real MCR application (non-blocking)
      if (!updated.is_application) {
        const borrowerRows = loan.borrower_id
          ? await sql`SELECT * FROM borrowers WHERE id = ${loan.borrower_id} LIMIT 1`
          : [];
        const gatePassed = checkApplicationGate(updated, borrowerRows[0]);
        if (gatePassed) {
          sql`UPDATE loans SET is_application = true, application_date = NOW(), updated_at = NOW() WHERE id = ${id}`.then(() =>
            sql`INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, created_at)
                VALUES (gen_random_uuid(), ${id}, 'application_gate_passed', 'system', 'application-gate',
                        'Loan meets all 5 Reg B fields — now an MCR application', NOW())`
          ).catch(() => {});
        }
      }

      return NextResponse.json({ loan: updated });
    }

    return NextResponse.json({ error: 'No valid update provided' }, { status: 400 });
  } catch (error) {
    console.error('Loan update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
