// API: 1003 Application Data
// GET  /api/portal/mlo/loans/:id/application — All 1003 data for a loan
// PUT  /api/portal/mlo/loans/:id/application — Upsert 1003 data (borrower fields, income, employment, declarations, transaction)
// POST /api/portal/mlo/loans/:id/application — Add repeating items (assets, liabilities, REO, employment)
//
// Design: PUT handles upsert for 1:1 models + borrower field updates.
//         POST handles adding new rows to 1:many models.
//         DELETE is a separate route at /application/[itemType]/[itemId].

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Helper: convert Decimal fields in object to numbers
function serializeDecimals(obj) {
  if (!obj) return null;
  const result = { ...obj };
  for (const [key, val] of Object.entries(result)) {
    if (val && typeof val === 'object' && typeof val.toNumber === 'function') {
      result[key] = Number(val);
    }
  }
  return result;
}

function serializeArray(arr) {
  return (arr || []).map(serializeDecimals);
}

// ─── GET: Full 1003 application data ───
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const loan = await prisma.loan.findUnique({
      where: { id },
      select: {
        id: true,
        amortizationType: true,
        titleHeldAs: true,
        estateHeldIn: true,
        armIndex: true,
        armMargin: true,
        armInitialCap: true,
        armPeriodicCap: true,
        armLifetimeCap: true,
        armAdjustmentPeriod: true,
        loanBorrowers: {
          orderBy: { ordinal: 'asc' },
          include: {
            borrower: {
              select: { id: true, firstName: true, lastName: true },
            },
            employments: { orderBy: { isPrimary: 'desc' } },
            income: true,
            declaration: true,
          },
        },
        assets: { orderBy: { createdAt: 'asc' } },
        liabilities: { orderBy: { createdAt: 'asc' } },
        reos: { orderBy: { createdAt: 'asc' } },
        transaction: true,
      },
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    // Serialize decimals
    const serialized = {
      ...loan,
      armMargin: loan.armMargin ? Number(loan.armMargin) : null,
      armInitialCap: loan.armInitialCap ? Number(loan.armInitialCap) : null,
      armPeriodicCap: loan.armPeriodicCap ? Number(loan.armPeriodicCap) : null,
      armLifetimeCap: loan.armLifetimeCap ? Number(loan.armLifetimeCap) : null,
      loanBorrowers: loan.loanBorrowers.map((lb) => ({
        ...lb,
        monthlyRent: lb.monthlyRent ? Number(lb.monthlyRent) : null,
        income: serializeDecimals(lb.income),
        employments: serializeArray(lb.employments),
      })),
      assets: serializeArray(loan.assets),
      liabilities: serializeArray(loan.liabilities),
      reos: serializeArray(loan.reos),
      transaction: serializeDecimals(loan.transaction),
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
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { section, loanBorrowerId, data, itemId } = body;

    if (!section || !data) {
      return NextResponse.json({ error: 'section and data required' }, { status: 400 });
    }

    // Verify loan exists
    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    let result;

    switch (section) {
      case 'borrower': {
        // Update LoanBorrower fields (housing, address, etc.)
        if (!loanBorrowerId) return NextResponse.json({ error: 'loanBorrowerId required' }, { status: 400 });
        const borrowerFields = {};
        const allowed = ['citizenship', 'housingType', 'monthlyRent', 'previousAddress',
          'previousAddressYears', 'previousAddressMonths', 'cellPhone', 'suffix',
          'currentAddress', 'addressYears', 'addressMonths', 'mailingAddress',
          'maritalStatus'];
        for (const f of allowed) {
          if (data[f] !== undefined) {
            let val = data[f];
            if (val === '') val = null;
            if (f === 'monthlyRent' && val !== null) val = parseFloat(val) || null;
            if (['previousAddressYears', 'previousAddressMonths', 'addressYears', 'addressMonths'].includes(f) && val !== null) {
              val = parseInt(val, 10) || null;
            }
            borrowerFields[f] = val;
          }
        }
        result = await prisma.loanBorrower.update({
          where: { id: loanBorrowerId },
          data: borrowerFields,
        });
        break;
      }

      case 'employment': {
        // Upsert employment record
        if (!loanBorrowerId) return NextResponse.json({ error: 'loanBorrowerId required' }, { status: 400 });
        const empData = {
          employerName: data.employerName ?? null,
          employerAddress: data.employerAddress ?? null,
          employerPhone: data.employerPhone ?? null,
          position: data.position ?? null,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          yearsOnJob: data.yearsOnJob != null ? parseInt(data.yearsOnJob, 10) : null,
          monthsOnJob: data.monthsOnJob != null ? parseInt(data.monthsOnJob, 10) : null,
          selfEmployed: data.selfEmployed ?? false,
          isPrimary: data.isPrimary ?? true,
        };
        if (itemId) {
          result = await prisma.loanEmployment.update({ where: { id: itemId }, data: empData });
        } else {
          result = await prisma.loanEmployment.create({
            data: { loanBorrowerId, ...empData },
          });
        }
        break;
      }

      case 'income': {
        // Upsert income (1:1 per borrower)
        if (!loanBorrowerId) return NextResponse.json({ error: 'loanBorrowerId required' }, { status: 400 });
        const incomeData = {};
        const incomeFields = ['baseMonthly', 'overtimeMonthly', 'bonusMonthly', 'commissionMonthly',
          'dividendsMonthly', 'interestMonthly', 'rentalIncomeMonthly', 'otherMonthly', 'otherIncomeSource'];
        for (const f of incomeFields) {
          if (data[f] !== undefined) {
            incomeData[f] = f === 'otherIncomeSource' ? (data[f] || null) : (parseFloat(data[f]) || null);
          }
        }
        result = await prisma.loanIncome.upsert({
          where: { loanBorrowerId },
          create: { loanBorrowerId, ...incomeData },
          update: incomeData,
        });
        break;
      }

      case 'asset': {
        // Update existing asset row
        if (!itemId) return NextResponse.json({ error: 'itemId required for asset update' }, { status: 400 });
        const assetData = {};
        if (data.institution !== undefined) assetData.institution = data.institution || null;
        if (data.accountType !== undefined) assetData.accountType = data.accountType || null;
        if (data.accountNumber !== undefined) assetData.accountNumber = data.accountNumber || null;
        if (data.balance !== undefined) assetData.balance = data.balance ? parseFloat(data.balance) : null;
        if (data.borrowerType !== undefined) assetData.borrowerType = data.borrowerType || null;
        if (data.isJoint !== undefined) assetData.isJoint = data.isJoint ?? false;
        result = await prisma.loanAsset.update({ where: { id: itemId }, data: assetData });
        break;
      }

      case 'liability': {
        // Update existing liability row
        if (!itemId) return NextResponse.json({ error: 'itemId required for liability update' }, { status: 400 });
        const liabData = {};
        if (data.creditor !== undefined) liabData.creditor = data.creditor || null;
        if (data.accountNumber !== undefined) liabData.accountNumber = data.accountNumber || null;
        if (data.liabilityType !== undefined) liabData.liabilityType = data.liabilityType || null;
        if (data.monthlyPayment !== undefined) liabData.monthlyPayment = data.monthlyPayment ? parseFloat(data.monthlyPayment) : null;
        if (data.unpaidBalance !== undefined) liabData.unpaidBalance = data.unpaidBalance ? parseFloat(data.unpaidBalance) : null;
        if (data.monthsRemaining !== undefined) liabData.monthsRemaining = data.monthsRemaining ? parseInt(data.monthsRemaining, 10) : null;
        if (data.paidOffAtClosing !== undefined) liabData.paidOffAtClosing = data.paidOffAtClosing ?? false;
        result = await prisma.loanLiability.update({ where: { id: itemId }, data: liabData });
        break;
      }

      case 'reo': {
        // Update existing REO row
        if (!itemId) return NextResponse.json({ error: 'itemId required for REO update' }, { status: 400 });
        const reoData = {};
        if (data.address !== undefined) reoData.address = data.address || null;
        if (data.propertyType !== undefined) reoData.propertyType = data.propertyType || null;
        if (data.presentMarketValue !== undefined) reoData.presentMarketValue = data.presentMarketValue ? parseFloat(data.presentMarketValue) : null;
        if (data.mortgageBalance !== undefined) reoData.mortgageBalance = data.mortgageBalance ? parseFloat(data.mortgageBalance) : null;
        if (data.mortgagePayment !== undefined) reoData.mortgagePayment = data.mortgagePayment ? parseFloat(data.mortgagePayment) : null;
        if (data.grossRentalIncome !== undefined) reoData.grossRentalIncome = data.grossRentalIncome ? parseFloat(data.grossRentalIncome) : null;
        if (data.netRentalIncome !== undefined) reoData.netRentalIncome = data.netRentalIncome ? parseFloat(data.netRentalIncome) : null;
        if (data.insuranceTaxesMaintenance !== undefined) reoData.insuranceTaxesMaintenance = data.insuranceTaxesMaintenance ? parseFloat(data.insuranceTaxesMaintenance) : null;
        if (data.status !== undefined) reoData.status = data.status || null;
        result = await prisma.loanREO.update({ where: { id: itemId }, data: reoData });
        break;
      }

      case 'declaration': {
        // Upsert declarations (1:1 per borrower)
        if (!loanBorrowerId) return NextResponse.json({ error: 'loanBorrowerId required' }, { status: 400 });
        const declData = {};
        const boolFields = ['outstandingJudgments', 'bankruptcy', 'foreclosure', 'partyToLawsuit',
          'loanDefault', 'alimonyObligation', 'delinquentFederalDebt', 'coSignerOnOtherLoan',
          'intentToOccupy', 'ownershipInterestLastThreeYears'];
        const strFields = ['bankruptcyType', 'propertyTypeOfOwnership'];
        const dateFields = ['bankruptcyDate', 'foreclosureDate'];
        for (const f of boolFields) {
          if (data[f] !== undefined) declData[f] = data[f] === true || data[f] === 'true';
        }
        for (const f of strFields) {
          if (data[f] !== undefined) declData[f] = data[f] || null;
        }
        for (const f of dateFields) {
          if (data[f] !== undefined) declData[f] = data[f] ? new Date(data[f]) : null;
        }
        result = await prisma.loanDeclaration.upsert({
          where: { loanBorrowerId },
          create: { loanBorrowerId, ...declData },
          update: declData,
        });
        break;
      }

      case 'transaction': {
        // Upsert transaction details (1:1 per loan)
        const txData = {};
        const decimalFields = ['purchasePrice', 'alterationsAmount', 'landValue',
          'refinanceOriginalCost', 'existingLiens', 'closingCostsEstimate',
          'discountPoints', 'pmiMip', 'sellerConcessions', 'subordinateFinancing',
          'cashFromBorrower'];
        for (const f of decimalFields) {
          if (data[f] !== undefined) txData[f] = parseFloat(data[f]) || null;
        }
        if (data.yearAcquired !== undefined) txData.yearAcquired = parseInt(data.yearAcquired, 10) || null;
        if (data.sourceOfDownPayment !== undefined) txData.sourceOfDownPayment = data.sourceOfDownPayment || null;
        result = await prisma.loanTransaction.upsert({
          where: { loanId: id },
          create: { loanId: id, ...txData },
          update: txData,
        });
        break;
      }

      case 'loanDetails': {
        // Update Loan-level 1003 fields (amortization, title, ARM)
        const loanData = {};
        const strFields = ['amortizationType', 'titleHeldAs', 'estateHeldIn', 'armIndex'];
        const decFields = ['armMargin', 'armInitialCap', 'armPeriodicCap', 'armLifetimeCap'];
        for (const f of strFields) {
          if (data[f] !== undefined) loanData[f] = data[f] || null;
        }
        for (const f of decFields) {
          if (data[f] !== undefined) loanData[f] = parseFloat(data[f]) || null;
        }
        if (data.armAdjustmentPeriod !== undefined) {
          loanData.armAdjustmentPeriod = parseInt(data.armAdjustmentPeriod, 10) || null;
        }
        result = await prisma.loan.update({ where: { id }, data: loanData });
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 400 });
    }

    // Audit
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'field_updated',
        actorType: 'mlo',
        actorId: session.user.id,
        newValue: JSON.stringify({ section, loanBorrowerId, itemId }),
        details: { source: '1003_application', section },
      },
    });

    return NextResponse.json({ success: true, result: serializeDecimals(result) });
  } catch (error) {
    console.error('1003 PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Add repeating items (assets, liabilities, REOs) ───
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { itemType, data } = body;

    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    let result;

    switch (itemType) {
      case 'asset':
        result = await prisma.loanAsset.create({
          data: {
            loanId: id,
            borrowerType: data.borrowerType || null,
            institution: data.institution || null,
            accountType: data.accountType || null,
            accountNumber: data.accountNumber || null,
            balance: data.balance ? parseFloat(data.balance) : null,
            isJoint: data.isJoint ?? false,
          },
        });
        break;

      case 'liability':
        result = await prisma.loanLiability.create({
          data: {
            loanId: id,
            creditor: data.creditor || null,
            accountNumber: data.accountNumber || null,
            liabilityType: data.liabilityType || null,
            monthlyPayment: data.monthlyPayment ? parseFloat(data.monthlyPayment) : null,
            unpaidBalance: data.unpaidBalance ? parseFloat(data.unpaidBalance) : null,
            monthsRemaining: data.monthsRemaining ? parseInt(data.monthsRemaining, 10) : null,
            paidOffAtClosing: data.paidOffAtClosing ?? false,
          },
        });
        break;

      case 'reo':
        result = await prisma.loanREO.create({
          data: {
            loanId: id,
            address: data.address || null,
            propertyType: data.propertyType || null,
            presentMarketValue: data.presentMarketValue ? parseFloat(data.presentMarketValue) : null,
            mortgageBalance: data.mortgageBalance ? parseFloat(data.mortgageBalance) : null,
            mortgagePayment: data.mortgagePayment ? parseFloat(data.mortgagePayment) : null,
            grossRentalIncome: data.grossRentalIncome ? parseFloat(data.grossRentalIncome) : null,
            netRentalIncome: data.netRentalIncome ? parseFloat(data.netRentalIncome) : null,
            insuranceTaxesMaintenance: data.insuranceTaxesMaintenance ? parseFloat(data.insuranceTaxesMaintenance) : null,
            status: data.status || 'retained',
          },
        });
        break;

      default:
        return NextResponse.json({ error: `Unknown itemType: ${itemType}` }, { status: 400 });
    }

    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'field_updated',
        actorType: 'mlo',
        actorId: session.user.id,
        newValue: JSON.stringify({ itemType, itemId: result.id }),
        details: { source: '1003_application', action: 'add', itemType },
      },
    });

    return NextResponse.json({ success: true, item: serializeDecimals(result) });
  } catch (error) {
    console.error('1003 POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Remove repeating items ───
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const itemType = searchParams.get('itemType');
    const itemId = searchParams.get('itemId');

    if (!itemType || !itemId) {
      return NextResponse.json({ error: 'itemType and itemId required' }, { status: 400 });
    }

    const modelMap = {
      asset: prisma.loanAsset,
      liability: prisma.loanLiability,
      reo: prisma.loanREO,
      employment: prisma.loanEmployment,
    };

    const model = modelMap[itemType];
    if (!model) {
      return NextResponse.json({ error: `Unknown itemType: ${itemType}` }, { status: 400 });
    }

    await model.delete({ where: { id: itemId } });

    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'field_updated',
        actorType: 'mlo',
        actorId: session.user.id,
        newValue: JSON.stringify({ itemType, itemId }),
        details: { source: '1003_application', action: 'delete', itemType },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('1003 DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
