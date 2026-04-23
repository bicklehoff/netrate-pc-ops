// API: 1003 Application Data
// GET  /api/portal/mlo/loans/:id/application — All 1003 data for a loan
// PUT  /api/portal/mlo/loans/:id/application — Upsert 1003 data (borrower fields, income, employment, declarations, transaction)
// POST /api/portal/mlo/loans/:id/application — Add repeating items (assets, liabilities, REO, employment)
//
// Design: PUT handles upsert for 1:1 models + borrower field updates.
//         POST handles adding new rows to 1:many models.
//         DELETE is a separate route at /application/[itemType]/[itemId].

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

// ─── GET: Full 1003 application data ───
export async function GET(request, { params }) {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    // Loan-level 1003 fields
    const loans = await sql`
      SELECT id, amortization_type, title_held_as, estate_held_in,
             arm_index, arm_margin, arm_initial_cap, arm_periodic_cap, arm_lifetime_cap, arm_adjustment_period
      FROM loans WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1
    `;
    if (loans.length === 0) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }
    const loan = loans[0];

    // Participants (borrowers) with sub-models
    const participants = await sql`
      SELECT lp.id, lp.loan_id, lp.contact_id, lp.ordinal, lp.marital_status,
        CASE lp.role WHEN 'primary_borrower' THEN 'primary' ELSE lp.role END AS borrower_type,
        c.first_name AS b_first_name, c.last_name AS b_last_name,
        c.suffix, c.us_citizenship_indicator AS citizenship,
        hh_cur.address AS current_address, hh_cur.years AS address_years,
        hh_cur.months AS address_months, hh_cur.monthly_rent,
        hh_cur.residency_type AS housing_type,
        hh_prev.address AS previous_address, hh_prev.years AS previous_address_years,
        hh_prev.months AS previous_address_months
      FROM loan_participants lp
      LEFT JOIN contacts c ON c.id = lp.contact_id
      LEFT JOIN loan_housing_history hh_cur
        ON hh_cur.loan_id = lp.loan_id AND hh_cur.contact_id = lp.contact_id AND hh_cur.housing_type = 'current'
      LEFT JOIN loan_housing_history hh_prev
        ON hh_prev.loan_id = lp.loan_id AND hh_prev.contact_id = lp.contact_id AND hh_prev.housing_type = 'previous'
      WHERE lp.loan_id = ${id}
        AND lp.role IN ('primary_borrower', 'co_borrower')
        AND lp.deleted_at IS NULL
      ORDER BY lp.ordinal ASC
    `;

    const contactIds = participants.map(p => p.contact_id);
    let employments = [];
    let incomes = [];
    let declarations = [];
    if (contactIds.length > 0) {
      employments = await sql`SELECT * FROM loan_employments WHERE loan_id = ${id} AND contact_id = ANY(${contactIds}) ORDER BY is_primary DESC`;
      incomes = await sql`SELECT * FROM loan_incomes WHERE loan_id = ${id} AND contact_id = ANY(${contactIds})`;
      declarations = await sql`SELECT * FROM loan_declarations WHERE loan_id = ${id} AND contact_id = ANY(${contactIds})`;
    }

    const assets = await sql`SELECT * FROM loan_assets WHERE loan_id = ${id} ORDER BY created_at ASC`;
    const liabilities = await sql`SELECT * FROM loan_liabilities WHERE loan_id = ${id} ORDER BY created_at ASC`;
    const reos = await sql`SELECT * FROM loan_reos WHERE loan_id = ${id} ORDER BY created_at ASC`;
    const transactionRows = await sql`SELECT * FROM loan_transactions WHERE loan_id = ${id} LIMIT 1`;

    const serialized = {
      ...loan,
      arm_margin: loan.arm_margin ? Number(loan.arm_margin) : null,
      arm_initial_cap: loan.arm_initial_cap ? Number(loan.arm_initial_cap) : null,
      arm_periodic_cap: loan.arm_periodic_cap ? Number(loan.arm_periodic_cap) : null,
      arm_lifetime_cap: loan.arm_lifetime_cap ? Number(loan.arm_lifetime_cap) : null,
      loan_borrowers: participants.map((lp) => ({
        ...lp,
        monthly_rent: lp.monthly_rent ? Number(lp.monthly_rent) : null,
        borrower: { id: lp.contact_id, first_name: lp.b_first_name, last_name: lp.b_last_name },
        employments: employments.filter(e => e.contact_id === lp.contact_id),
        income: incomes.find(i => i.contact_id === lp.contact_id) || null,
        declaration: declarations.find(d => d.contact_id === lp.contact_id) || null,
      })),
      assets,
      liabilities,
      reos,
      transaction: transactionRows[0] || null,
    };

    return NextResponse.json({ application: serialized });
  } catch (error) {
    console.error('1003 GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PUT: Upsert 1003 data ───
// Body shape: { section, loanBorrowerId?, data }
// section: 'borrower' | 'employment' | 'income' | 'declaration' | 'transaction' | 'loanDetails'
export async function PUT(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await request.json();
    const { section, loanBorrowerId, data, itemId } = body;

    if (!section || !data) {
      return NextResponse.json({ error: 'section and data required' }, { status: 400 });
    }

    // Verify loan exists
    const loanRows = await sql`SELECT id FROM loans WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    if (loanRows.length === 0) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    let result;

    switch (section) {
      case 'borrower': {
        if (!loanBorrowerId) return NextResponse.json({ error: 'loanBorrowerId required' }, { status: 400 });

        // loanBorrowerId is now loan_participants.id
        const lpLookup = await sql`SELECT contact_id FROM loan_participants WHERE id = ${loanBorrowerId} AND loan_id = ${id} LIMIT 1`;
        if (!lpLookup[0]) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
        const contactId = lpLookup[0].contact_id;

        const lpFields = {};      // → loan_participants
        const contactFields = {}; // → contacts
        const curHousing = {};    // → loan_housing_history (current)
        const prevHousing = {};   // → loan_housing_history (previous)

        if (data.maritalStatus !== undefined) lpFields.marital_status = data.maritalStatus || null;
        if (data.citizenship !== undefined) contactFields.us_citizenship_indicator = data.citizenship || null;
        if (data.cellPhone !== undefined) contactFields.phone = data.cellPhone || null;
        if (data.suffix !== undefined) contactFields.suffix = data.suffix || null;

        const curHousingMap = { housingType: 'residency_type', monthlyRent: 'monthly_rent', currentAddress: 'address', addressYears: 'years', addressMonths: 'months' };
        for (const [camel, col] of Object.entries(curHousingMap)) {
          if (data[camel] !== undefined) {
            let v = data[camel] === '' ? null : data[camel];
            if (col === 'monthly_rent' && v !== null) v = parseFloat(v) || null;
            if (['years', 'months'].includes(col) && v !== null) v = parseInt(v, 10) || null;
            curHousing[col] = v;
          }
        }
        const prevHousingMap = { previousAddress: 'address', previousAddressYears: 'years', previousAddressMonths: 'months' };
        for (const [camel, col] of Object.entries(prevHousingMap)) {
          if (data[camel] !== undefined) {
            let v = data[camel] === '' ? null : data[camel];
            if (['years', 'months'].includes(col) && v !== null) v = parseInt(v, 10) || null;
            prevHousing[col] = v;
          }
        }

        if (Object.keys(lpFields).length > 0) {
          const cols = Object.keys(lpFields);
          const setFragments = cols.map((c, i) => `"${c}" = $${i + 1}`);
          await sql(`UPDATE loan_participants SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1}`, [...Object.values(lpFields), loanBorrowerId]);
        }
        if (Object.keys(contactFields).length > 0) {
          const cols = Object.keys(contactFields);
          const setFragments = cols.map((c, i) => `"${c}" = $${i + 1}`);
          await sql(`UPDATE contacts SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1}`, [...Object.values(contactFields), contactId]);
        }

        const upsertHousing = async (housingType, fields) => {
          if (Object.keys(fields).length === 0) return;
          const existRows = await sql`SELECT id FROM loan_housing_history WHERE loan_id = ${id} AND contact_id = ${contactId} AND housing_type = ${housingType} LIMIT 1`;
          if (existRows[0]) {
            const cols = Object.keys(fields);
            const setFragments = cols.map((c, i) => `"${c}" = $${i + 1}`);
            await sql(`UPDATE loan_housing_history SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1}`, [...Object.values(fields), existRows[0].id]);
          } else {
            const cols = ['loan_id', 'contact_id', 'housing_type', 'ordinal', ...Object.keys(fields)];
            const vals = [id, contactId, housingType, 0, ...Object.values(fields)];
            const placeholders = cols.map((_, i) => `$${i + 1}`);
            await sql(`INSERT INTO loan_housing_history (id, ${cols.map(c => `"${c}"`).join(', ')}) VALUES (gen_random_uuid(), ${placeholders.join(', ')})`, vals);
          }
        };
        await upsertHousing('current', curHousing);
        await upsertHousing('previous', prevHousing);

        const updRows = await sql`SELECT * FROM loan_participants WHERE id = ${loanBorrowerId} LIMIT 1`;
        result = updRows[0];
        break;
      }

      case 'employment': {
        if (!loanBorrowerId) return NextResponse.json({ error: 'loanBorrowerId required' }, { status: 400 });
        const empData = {
          employer_name: data.employerName ?? null,
          employer_address: data.employerAddress ? JSON.stringify(data.employerAddress) : null,
          employer_phone: data.employerPhone ?? null,
          position: data.position ?? null,
          start_date: data.startDate ? new Date(data.startDate) : null,
          end_date: data.endDate ? new Date(data.endDate) : null,
          years_on_job: data.yearsOnJob != null ? parseInt(data.yearsOnJob, 10) : null,
          months_on_job: data.monthsOnJob != null ? parseInt(data.monthsOnJob, 10) : null,
          self_employed: data.selfEmployed ?? false,
          is_primary: data.isPrimary ?? true,
        };
        if (itemId) {
          const cols = Object.keys(empData);
          const vals = Object.values(empData);
          const setFragments = cols.map((c, i) => `"${c}" = $${i + 1}`);
          const q = `UPDATE loan_employments SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1} RETURNING *`;
          const rows = await sql(q, [...vals, itemId]);
          result = rows[0];
        } else {
          // loanBorrowerId is now loan_participants.id — resolve contact_id
          const lpEmp = await sql`SELECT contact_id FROM loan_participants WHERE id = ${loanBorrowerId} AND loan_id = ${id} LIMIT 1`;
          if (!lpEmp[0]) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
          const rows = await sql`
            INSERT INTO loan_employments (id, loan_id, contact_id, employer_name, employer_address, employer_phone, position, start_date, end_date, years_on_job, months_on_job, self_employed, is_primary, created_at, updated_at)
            VALUES (gen_random_uuid(), ${id}, ${lpEmp[0].contact_id}, ${empData.employer_name}, ${empData.employer_address}, ${empData.employer_phone}, ${empData.position}, ${empData.start_date}, ${empData.end_date}, ${empData.years_on_job}, ${empData.months_on_job}, ${empData.self_employed}, ${empData.is_primary}, NOW(), NOW())
            RETURNING *
          `;
          result = rows[0];
        }
        break;
      }

      case 'income': {
        if (!loanBorrowerId) return NextResponse.json({ error: 'loanBorrowerId required' }, { status: 400 });
        const incomeData = {};
        const incomeFields = {
          baseMonthly: 'base_monthly', overtimeMonthly: 'overtime_monthly', bonusMonthly: 'bonus_monthly',
          commissionMonthly: 'commission_monthly', dividendsMonthly: 'dividends_monthly',
          interestMonthly: 'interest_monthly', rentalIncomeMonthly: 'rental_income_monthly',
          otherMonthly: 'other_monthly', otherIncomeSource: 'other_income_source',
        };
        for (const [camel, snake] of Object.entries(incomeFields)) {
          if (data[camel] !== undefined) {
            incomeData[snake] = snake === 'other_income_source' ? (data[camel] || null) : (parseFloat(data[camel]) || null);
          }
        }
        if (Object.keys(incomeData).length > 0) {
          // loanBorrowerId is now loan_participants.id — resolve contact_id
          const lpInc = await sql`SELECT contact_id FROM loan_participants WHERE id = ${loanBorrowerId} AND loan_id = ${id} LIMIT 1`;
          if (!lpInc[0]) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
          const incContactId = lpInc[0].contact_id;
          const existInc = await sql`SELECT id FROM loan_incomes WHERE loan_id = ${id} AND contact_id = ${incContactId} LIMIT 1`;
          const cols = Object.keys(incomeData);
          const vals = Object.values(incomeData);
          if (existInc[0]) {
            const setFragments = cols.map((c, i) => `"${c}" = $${i + 1}`);
            const rows = await sql(`UPDATE loan_incomes SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1} RETURNING *`, [...vals, existInc[0].id]);
            result = rows[0];
          } else {
            const insertCols = ['loan_id', 'contact_id', ...cols];
            const placeholders = insertCols.map((_, i) => `$${i + 1}`);
            const rows = await sql(`INSERT INTO loan_incomes (id, ${insertCols.map(c => `"${c}"`).join(', ')}, created_at, updated_at) VALUES (gen_random_uuid(), ${placeholders.join(', ')}, NOW(), NOW()) RETURNING *`, [id, incContactId, ...vals]);
            result = rows[0];
          }
        }
        break;
      }

      case 'asset': {
        if (!itemId) return NextResponse.json({ error: 'itemId required for asset update' }, { status: 400 });
        const assetData = {};
        if (data.institution !== undefined) assetData.institution = data.institution || null;
        if (data.accountType !== undefined) assetData.account_type = data.accountType || null;
        if (data.accountNumber !== undefined) assetData.account_number = data.accountNumber || null;
        if (data.balance !== undefined) assetData.balance = data.balance ? parseFloat(data.balance) : null;
        if (data.borrowerType !== undefined) assetData.borrower_type = data.borrowerType || null;
        if (data.isJoint !== undefined) assetData.is_joint = data.isJoint ?? false;
        if (Object.keys(assetData).length > 0) {
          const cols = Object.keys(assetData);
          const vals = Object.values(assetData);
          const setFragments = cols.map((c, i) => `"${c}" = $${i + 1}`);
          const q = `UPDATE loan_assets SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1} RETURNING *`;
          const rows = await sql(q, [...vals, itemId]);
          result = rows[0];
        }
        break;
      }

      case 'liability': {
        if (!itemId) return NextResponse.json({ error: 'itemId required for liability update' }, { status: 400 });
        const liabData = {};
        if (data.creditor !== undefined) liabData.creditor = data.creditor || null;
        if (data.accountNumber !== undefined) liabData.account_number = data.accountNumber || null;
        if (data.liabilityType !== undefined) liabData.liability_type = data.liabilityType || null;
        if (data.monthlyPayment !== undefined) liabData.monthly_payment = data.monthlyPayment ? parseFloat(data.monthlyPayment) : null;
        if (data.unpaidBalance !== undefined) liabData.unpaid_balance = data.unpaidBalance ? parseFloat(data.unpaidBalance) : null;
        if (data.monthsRemaining !== undefined) liabData.months_remaining = data.monthsRemaining ? parseInt(data.monthsRemaining, 10) : null;
        if (data.paidOffAtClosing !== undefined) liabData.paid_off_at_closing = data.paidOffAtClosing ?? false;
        if (Object.keys(liabData).length > 0) {
          const cols = Object.keys(liabData);
          const vals = Object.values(liabData);
          const setFragments = cols.map((c, i) => `"${c}" = $${i + 1}`);
          const q = `UPDATE loan_liabilities SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1} RETURNING *`;
          const rows = await sql(q, [...vals, itemId]);
          result = rows[0];
        }
        break;
      }

      case 'reo': {
        if (!itemId) return NextResponse.json({ error: 'itemId required for REO update' }, { status: 400 });
        const reoData = {};
        if (data.address !== undefined) reoData.address = data.address ? JSON.stringify(data.address) : null;
        if (data.propertyType !== undefined) reoData.property_type = data.propertyType || null;
        if (data.presentMarketValue !== undefined) reoData.present_market_value = data.presentMarketValue ? parseFloat(data.presentMarketValue) : null;
        if (data.mortgageBalance !== undefined) reoData.mortgage_balance = data.mortgageBalance ? parseFloat(data.mortgageBalance) : null;
        if (data.mortgagePayment !== undefined) reoData.mortgage_payment = data.mortgagePayment ? parseFloat(data.mortgagePayment) : null;
        if (data.grossRentalIncome !== undefined) reoData.gross_rental_income = data.grossRentalIncome ? parseFloat(data.grossRentalIncome) : null;
        if (data.netRentalIncome !== undefined) reoData.net_rental_income = data.netRentalIncome ? parseFloat(data.netRentalIncome) : null;
        if (data.insuranceTaxesMaintenance !== undefined) reoData.insurance_taxes_maintenance = data.insuranceTaxesMaintenance ? parseFloat(data.insuranceTaxesMaintenance) : null;
        if (data.status !== undefined) reoData.status = data.status || null;
        if (Object.keys(reoData).length > 0) {
          const cols = Object.keys(reoData);
          const vals = Object.values(reoData);
          const setFragments = cols.map((c, i) => `"${c}" = $${i + 1}`);
          const q = `UPDATE loan_reos SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1} RETURNING *`;
          const rows = await sql(q, [...vals, itemId]);
          result = rows[0];
        }
        break;
      }

      case 'declaration': {
        if (!loanBorrowerId) return NextResponse.json({ error: 'loanBorrowerId required' }, { status: 400 });
        const declData = {};
        const boolFields = {
          outstandingJudgments: 'outstanding_judgments', bankruptcy: 'bankruptcy', foreclosure: 'foreclosure',
          partyToLawsuit: 'party_to_lawsuit', loanDefault: 'loan_default', alimonyObligation: 'alimony_obligation',
          delinquentFederalDebt: 'delinquent_federal_debt', coSignerOnOtherLoan: 'co_signer_on_other_loan',
          intentToOccupy: 'intent_to_occupy', ownershipInterestLastThreeYears: 'ownership_interest_last_three_years',
        };
        const strFields = { bankruptcyType: 'bankruptcy_type', propertyTypeOfOwnership: 'property_type_of_ownership' };
        const dateFields = { bankruptcyDate: 'bankruptcy_date', foreclosureDate: 'foreclosure_date' };
        for (const [camel, snake] of Object.entries(boolFields)) {
          if (data[camel] !== undefined) declData[snake] = data[camel] === true || data[camel] === 'true';
        }
        for (const [camel, snake] of Object.entries(strFields)) {
          if (data[camel] !== undefined) declData[snake] = data[camel] || null;
        }
        for (const [camel, snake] of Object.entries(dateFields)) {
          if (data[camel] !== undefined) declData[snake] = data[camel] ? new Date(data[camel]) : null;
        }
        if (Object.keys(declData).length > 0) {
          // loanBorrowerId is now loan_participants.id — resolve contact_id
          const lpDecl = await sql`SELECT contact_id FROM loan_participants WHERE id = ${loanBorrowerId} AND loan_id = ${id} LIMIT 1`;
          if (!lpDecl[0]) return NextResponse.json({ error: 'Participant not found' }, { status: 404 });
          const declContactId = lpDecl[0].contact_id;
          const existDecl = await sql`SELECT id FROM loan_declarations WHERE loan_id = ${id} AND contact_id = ${declContactId} LIMIT 1`;
          const cols = Object.keys(declData);
          const vals = Object.values(declData);
          if (existDecl[0]) {
            const setFragments = cols.map((c, i) => `"${c}" = $${i + 1}`);
            const rows = await sql(`UPDATE loan_declarations SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1} RETURNING *`, [...vals, existDecl[0].id]);
            result = rows[0];
          } else {
            const insertCols = ['loan_id', 'contact_id', ...cols];
            const placeholders = insertCols.map((_, i) => `$${i + 1}`);
            const rows = await sql(`INSERT INTO loan_declarations (id, ${insertCols.map(c => `"${c}"`).join(', ')}, created_at, updated_at) VALUES (gen_random_uuid(), ${placeholders.join(', ')}, NOW(), NOW()) RETURNING *`, [id, declContactId, ...vals]);
            result = rows[0];
          }
        }
        break;
      }

      case 'transaction': {
        const txData = {};
        const decimalFields = {
          purchasePrice: 'purchase_price', alterationsAmount: 'alterations_amount', landValue: 'land_value',
          refinanceOriginalCost: 'refinance_original_cost', existingLiens: 'existing_liens',
          closingCostsEstimate: 'closing_costs_estimate', discountPoints: 'discount_points',
          pmiMip: 'pmi_mip', sellerConcessions: 'seller_concessions',
          subordinateFinancing: 'subordinate_financing', cashFromBorrower: 'cash_from_borrower',
        };
        for (const [camel, snake] of Object.entries(decimalFields)) {
          if (data[camel] !== undefined) txData[snake] = parseFloat(data[camel]) || null;
        }
        if (data.yearAcquired !== undefined) txData.year_acquired = parseInt(data.yearAcquired, 10) || null;
        if (data.sourceOfDownPayment !== undefined) txData.source_of_down_payment = data.sourceOfDownPayment || null;
        if (Object.keys(txData).length > 0) {
          const cols = Object.keys(txData);
          const vals = Object.values(txData);
          const updateFragments = cols.map((c, i) => `"${c}" = $${i + 2}`);
          const insertCols = ['loan_id', ...cols];
          const insertPlaceholders = insertCols.map((_, i) => `$${i + 1}`);
          const q = `INSERT INTO loan_transactions (id, ${insertCols.map(c => `"${c}"`).join(', ')}, created_at, updated_at)
                     VALUES (gen_random_uuid(), ${insertPlaceholders.join(', ')}, NOW(), NOW())
                     ON CONFLICT (loan_id) DO UPDATE SET ${updateFragments.join(', ')}, updated_at = NOW()
                     RETURNING *`;
          const rows = await sql(q, [id, ...vals]);
          result = rows[0];
        }
        break;
      }

      case 'loanDetails': {
        const loanData = {};
        const strFields = { amortizationType: 'amortization_type', titleHeldAs: 'title_held_as', estateHeldIn: 'estate_held_in', armIndex: 'arm_index' };
        const decFields = { armMargin: 'arm_margin', armInitialCap: 'arm_initial_cap', armPeriodicCap: 'arm_periodic_cap', armLifetimeCap: 'arm_lifetime_cap' };
        for (const [camel, snake] of Object.entries(strFields)) {
          if (data[camel] !== undefined) loanData[snake] = data[camel] || null;
        }
        for (const [camel, snake] of Object.entries(decFields)) {
          if (data[camel] !== undefined) loanData[snake] = parseFloat(data[camel]) || null;
        }
        if (data.armAdjustmentPeriod !== undefined) {
          loanData.arm_adjustment_period = parseInt(data.armAdjustmentPeriod, 10) || null;
        }
        if (Object.keys(loanData).length > 0) {
          const cols = Object.keys(loanData);
          const vals = Object.values(loanData);
          const setFragments = cols.map((c, i) => `"${c}" = $${i + 1}`);
          const q = `UPDATE loans SET ${setFragments.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1} RETURNING *`;
          const rows = await sql(q, [...vals, id]);
          result = rows[0];
        }
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 400 });
    }

    // Audit
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'field_updated', 'mlo', ${mloId},
              ${JSON.stringify({ section, loanBorrowerId, itemId })},
              ${JSON.stringify({ source: '1003_application', section })},
              NOW())
    `;

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('1003 PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Add repeating items (assets, liabilities, REOs) ───
export async function POST(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await request.json();
    const { itemType, data } = body;

    const loanRows = await sql`SELECT id FROM loans WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    if (loanRows.length === 0) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    let result;

    switch (itemType) {
      case 'asset': {
        const rows = await sql`
          INSERT INTO loan_assets (id, loan_id, borrower_type, institution, account_type, account_number, balance, is_joint, created_at, updated_at)
          VALUES (gen_random_uuid(), ${id}, ${data.borrowerType || null}, ${data.institution || null}, ${data.accountType || null}, ${data.accountNumber || null}, ${data.balance ? parseFloat(data.balance) : null}, ${data.isJoint ?? false}, NOW(), NOW())
          RETURNING *
        `;
        result = rows[0];
        break;
      }

      case 'liability': {
        const rows = await sql`
          INSERT INTO loan_liabilities (id, loan_id, creditor, account_number, liability_type, monthly_payment, unpaid_balance, months_remaining, paid_off_at_closing, created_at, updated_at)
          VALUES (gen_random_uuid(), ${id}, ${data.creditor || null}, ${data.accountNumber || null}, ${data.liabilityType || null}, ${data.monthlyPayment ? parseFloat(data.monthlyPayment) : null}, ${data.unpaidBalance ? parseFloat(data.unpaidBalance) : null}, ${data.monthsRemaining ? parseInt(data.monthsRemaining, 10) : null}, ${data.paidOffAtClosing ?? false}, NOW(), NOW())
          RETURNING *
        `;
        result = rows[0];
        break;
      }

      case 'reo': {
        const rows = await sql`
          INSERT INTO loan_reos (id, loan_id, address, property_type, present_market_value, mortgage_balance, mortgage_payment, gross_rental_income, net_rental_income, insurance_taxes_maintenance, status, created_at, updated_at)
          VALUES (gen_random_uuid(), ${id}, ${data.address ? JSON.stringify(data.address) : null}, ${data.propertyType || null}, ${data.presentMarketValue ? parseFloat(data.presentMarketValue) : null}, ${data.mortgageBalance ? parseFloat(data.mortgageBalance) : null}, ${data.mortgagePayment ? parseFloat(data.mortgagePayment) : null}, ${data.grossRentalIncome ? parseFloat(data.grossRentalIncome) : null}, ${data.netRentalIncome ? parseFloat(data.netRentalIncome) : null}, ${data.insuranceTaxesMaintenance ? parseFloat(data.insuranceTaxesMaintenance) : null}, ${data.status || 'retained'}, NOW(), NOW())
          RETURNING *
        `;
        result = rows[0];
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown itemType: ${itemType}` }, { status: 400 });
    }

    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'field_updated', 'mlo', ${mloId},
              ${JSON.stringify({ itemType, itemId: result.id })},
              ${JSON.stringify({ source: '1003_application', action: 'add', itemType })},
              NOW())
    `;

    return NextResponse.json({ success: true, item: result });
  } catch (error) {
    console.error('1003 POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Remove repeating items ───
export async function DELETE(request, { params }) {
  try {
    const { session, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const itemType = searchParams.get('itemType');
    const itemId = searchParams.get('itemId');

    if (!itemType || !itemId) {
      return NextResponse.json({ error: 'itemType and itemId required' }, { status: 400 });
    }

    const tableMap = {
      asset: 'loan_assets',
      liability: 'loan_liabilities',
      reo: 'loan_reos',
      employment: 'loan_employments',
    };

    const table = tableMap[itemType];
    if (!table) {
      return NextResponse.json({ error: `Unknown itemType: ${itemType}` }, { status: 400 });
    }

    await sql(`DELETE FROM ${table} WHERE id = $1`, [itemId]);

    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'field_updated', 'mlo', ${mloId},
              ${JSON.stringify({ itemType, itemId })},
              ${JSON.stringify({ source: '1003_application', action: 'delete', itemType })},
              NOW())
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('1003 DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
