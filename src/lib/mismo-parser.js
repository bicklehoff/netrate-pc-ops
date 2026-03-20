// MISMO 3.4 XML Parser
// Parses Fannie Mae MISMO 3.4 (ULAD) XML into our loan schema.
// Handles real-world exports from Encompass, BytePro, and other LOS systems.
//
// Strategy: Best-effort extraction with graceful fallbacks.
// MISMO XML varies by LOS vendor — we extract what we can and skip what's missing.

import { XMLParser } from 'fast-xml-parser';

// ─── XML Parser Config ──────────────────────────────────────
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => {
    // Force these to always be arrays even when there's only one
    const alwaysArray = [
      'DEAL', 'LOAN', 'PARTY', 'LOAN_IDENTIFIER', 'COLLATERAL',
      'CONTACT_POINT', 'RESIDENCE', 'EMPLOYER', 'CURRENT_INCOME_ITEM',
      'HOUSING_EXPENSE', 'TAXPAYER_IDENTIFIER', 'ROLE',
      'LOAN_BORROWER', 'CO_BORROWER',
    ];
    return alwaysArray.includes(name);
  },
  removeNSPrefix: true, // Strip namespace prefixes for easier traversal
});

// ─── Safe accessor (deeply nested MISMO paths) ──────────────
function dig(obj, ...keys) {
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return cur;
}

// Force value to array
function toArray(val) {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

// Safe number parse
function num(val) {
  if (val == null || val === '') return null;
  const n = parseFloat(val);
  return Number.isNaN(n) ? null : n;
}

// Safe integer parse
function int(val) {
  if (val == null || val === '') return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
}

// Clean string
function str(val) {
  if (val == null) return null;
  const s = String(val).trim();
  return s || null;
}

// ─── Main Parser ────────────────────────────────────────────

/**
 * Parse a MISMO 3.4 XML string into our internal loan format.
 * Returns: { loan, borrowers[], property, employment, declarations, raw }
 */
export function parseMismoXml(xmlString) {
  const parsed = parser.parse(xmlString);

  // Navigate to the DEAL — most data lives here
  // Handle both MESSAGE > DEAL_SETS and direct DEAL_SETS patterns
  const message = parsed.MESSAGE || parsed;
  const dealSet = dig(message, 'DEAL_SETS', 'DEAL_SET');
  const deals = toArray(dig(dealSet, 'DEALS', 'DEAL'));

  if (!deals.length) {
    throw new Error('No DEAL found in MISMO XML. File may be malformed or use an unsupported format.');
  }

  const deal = deals[0]; // Primary deal

  // ─── Extract Loan Data ──────────────────────────────────
  const loans = toArray(dig(deal, 'LOANS', 'LOAN'));
  const loanData = loans[0] || {};

  const loanIdentifiers = toArray(dig(loanData, 'LOAN_IDENTIFIERS', 'LOAN_IDENTIFIER'));
  const terms = dig(loanData, 'TERMS_OF_LOAN') || {};
  const loanProduct = dig(loanData, 'LOAN_PRODUCT', 'LOAN_PRODUCT_DETAIL') || {};

  // Find loan number from identifiers
  let loanNumber = null;
  for (const lid of loanIdentifiers) {
    const idType = str(lid.LoanIdentifierType);
    if (idType === 'LenderLoan' || idType === 'UniversalLoan' || idType === 'SellerLoan') {
      loanNumber = str(lid.LoanIdentifier);
      if (loanNumber) break;
    }
  }
  // Fallback: take any identifier
  if (!loanNumber && loanIdentifiers.length > 0) {
    loanNumber = str(loanIdentifiers[0].LoanIdentifier);
  }

  // Loan purpose mapping
  const purposeRaw = str(terms.LoanPurposeType) || '';
  const purpose = mapPurpose(purposeRaw);

  // Loan type mapping
  const loanProductType = str(loanProduct.LoanProductType) || str(terms.MortgageType) || '';
  const loanType = mapLoanType(loanProductType);

  // Amounts
  const loanAmount = num(terms.BaseLoanAmount) || num(terms.NoteAmount);
  const interestRate = num(terms.NoteRatePercent) || num(terms.WeightedAverageInterestRatePercent);
  const loanTerm = int(terms.LoanMaturityPeriodCount) || int(terms.OriginalLoanMaturityPeriodCount);

  // ─── Extract Parties (Borrowers) ────────────────────────
  const parties = toArray(dig(deal, 'PARTIES', 'PARTY'));
  const borrowers = [];
  let lenderName = null;

  for (const party of parties) {
    const roles = toArray(dig(party, 'ROLES', 'ROLE'));
    for (const role of roles) {
      const roleType = str(dig(role, 'ROLE_DETAIL', 'PartyRoleType'));

      if (roleType === 'Borrower') {
        borrowers.push(extractBorrower(party, role, borrowers.length));
      }

      if (roleType === 'NotePayAddress' || roleType === 'Lender') {
        // Extract lender name
        const legalName = str(dig(party, 'LEGAL_ENTITY', 'LEGAL_ENTITY_DETAIL', 'FullName'));
        const orgName = str(dig(party, 'ORGANIZATION', 'OrganizationName'));
        lenderName = legalName || orgName || lenderName;
      }
    }
  }

  // ─── Extract Property (Collateral) ──────────────────────
  const collaterals = toArray(dig(deal, 'COLLATERALS', 'COLLATERAL'));
  const property = extractProperty(collaterals[0]);

  // ─── Extract Housing Expenses ───────────────────────────
  const housingExpenses = toArray(dig(loanData, 'HOUSING_EXPENSES', 'HOUSING_EXPENSE'));
  let presentHousingExpense = null;
  for (const exp of housingExpenses) {
    if (str(exp.HousingExpenseTimingType) === 'Present') {
      presentHousingExpense = num(exp.HousingExpensePaymentAmount);
      break;
    }
  }

  // ─── Build Result ───────────────────────────────────────
  return {
    loan: {
      loanNumber,
      purpose,
      loanType,
      loanAmount,
      interestRate,
      loanTerm,
      lenderName,
      presentHousingExpense,
      occupancy: mapOccupancy(str(property.occupancy)),
      propertyType: mapPropertyType(str(property.propertyType)),
      numUnits: property.numUnits,
      purchasePrice: property.purchasePrice,
      estimatedValue: property.estimatedValue,
    },
    borrowers,
    property: {
      address: property.address,
    },
    // Convenience: primary borrower (first one)
    primaryBorrower: borrowers[0] || null,
    coBorrowers: borrowers.slice(1),
    // Stats for preview
    stats: {
      dealCount: deals.length,
      partyCount: parties.length,
      borrowerCount: borrowers.length,
      hasLoanNumber: !!loanNumber,
      hasSSN: borrowers.some((b) => !!b.ssn),
      hasDOB: borrowers.some((b) => !!b.dob),
    },
  };
}

// ─── Extract a Borrower from PARTY + ROLE ─────────────────

function extractBorrower(party, role, index) {
  const name = dig(party, 'INDIVIDUAL', 'NAME') || {};
  const contactPoints = toArray(dig(party, 'INDIVIDUAL', 'CONTACT_POINTS', 'CONTACT_POINT'));
  const taxpayerIds = toArray(dig(party, 'TAXPAYER_IDENTIFIERS', 'TAXPAYER_IDENTIFIER'));
  const borrowerDetail = dig(role, 'BORROWER', 'BORROWER_DETAIL') || {};

  // Extract contact info
  let email = null;
  let phone = null;
  for (const cp of contactPoints) {
    if (cp.CONTACT_POINT_EMAIL) {
      email = str(dig(cp, 'CONTACT_POINT_EMAIL', 'ContactPointEmailValue')) || email;
    }
    if (cp.CONTACT_POINT_TELEPHONE) {
      phone = str(dig(cp, 'CONTACT_POINT_TELEPHONE', 'ContactPointTelephoneValue')) || phone;
    }
  }

  // Extract SSN
  let ssn = null;
  for (const tid of taxpayerIds) {
    if (str(tid.TaxpayerIdentifierType) === 'SocialSecurityNumber') {
      ssn = str(tid.TaxpayerIdentifierValue);
      break;
    }
  }
  // Fallback: take any taxpayer identifier
  if (!ssn && taxpayerIds.length > 0) {
    ssn = str(taxpayerIds[0].TaxpayerIdentifierValue);
  }

  // Extract DOB
  const dob = str(party.BIRTH_DATE) || str(dig(party, 'INDIVIDUAL', 'BIRTH_DATE'));

  // Extract residences
  const residences = toArray(dig(party, 'RESIDENCES', 'RESIDENCE'))
    || toArray(dig(role, 'BORROWER', 'RESIDENCES', 'RESIDENCE'));
  const currentResidence = residences.find(
    (r) => str(r.BorrowerResidencyType) === 'Current' || str(r['@_BorrowerResidencyType']) === 'Current'
  ) || residences[0];
  const address = extractAddress(dig(currentResidence, 'ADDRESS'));
  const addressYears = int(dig(currentResidence, 'RESIDENCE_DETAIL', 'BorrowerResidencyDurationYearsCount'));
  const addressMonths = int(dig(currentResidence, 'RESIDENCE_DETAIL', 'BorrowerResidencyDurationMonthsCount'));

  // Extract employment
  const employers = toArray(dig(role, 'BORROWER', 'EMPLOYERS', 'EMPLOYER'))
    || toArray(dig(party, 'EMPLOYERS', 'EMPLOYER'));
  const currentEmployer = employers.find(
    (e) => str(dig(e, 'EMPLOYER_DETAIL', 'EmploymentStatusType')) !== 'Previous'
      && str(e.EmploymentCurrentIndicator) !== 'false'
  ) || employers[0];

  const employment = extractEmployment(currentEmployer);

  // Extract income
  const incomeItems = toArray(
    dig(role, 'BORROWER', 'CURRENT_INCOME', 'CURRENT_INCOME_ITEMS', 'CURRENT_INCOME_ITEM')
  );
  const income = extractIncome(incomeItems);

  // Extract declarations
  const declarations = extractDeclarations(dig(role, 'BORROWER', 'DECLARATION', 'DECLARATION_DETAIL'));

  // Marital status
  const maritalStatus = mapMaritalStatus(str(borrowerDetail.MaritalStatusType));

  return {
    ordinal: index,
    borrowerType: index === 0 ? 'primary' : 'co_borrower',
    firstName: str(name.FirstName),
    lastName: str(name.LastName),
    middleName: str(name.MiddleName),
    suffix: str(name.SuffixName),
    email,
    phone,
    ssn: ssn ? ssn.replace(/\D/g, '') : null, // Strip formatting
    dob,
    maritalStatus,
    currentAddress: address,
    addressYears,
    addressMonths,
    ...employment,
    ...income,
    declarations,
  };
}

// ─── Extract Property ─────────────────────────────────────

function extractProperty(collateral) {
  if (!collateral) return { address: null, occupancy: null, propertyType: null, numUnits: null, purchasePrice: null, estimatedValue: null };

  const subjectProp = dig(collateral, 'SUBJECT_PROPERTY') || {};
  const propDetail = dig(subjectProp, 'PROPERTY_DETAIL') || {};
  const address = extractAddress(dig(subjectProp, 'ADDRESS'));

  // Sales contract for purchase price
  const salesContracts = toArray(dig(collateral, 'SALES_CONTRACTS', 'SALES_CONTRACT'));
  let purchasePrice = null;
  for (const sc of salesContracts) {
    purchasePrice = num(dig(sc, 'SALES_CONTRACT_DETAIL', 'SalesContractAmount'));
    if (purchasePrice) break;
  }
  // Fallback: PropertyEstimatedValueAmount or FinancedUnitCount
  if (!purchasePrice) {
    purchasePrice = num(propDetail.PropertyEstimatedValueAmount);
  }

  return {
    address,
    occupancy: str(propDetail.PropertyUsageType) || str(propDetail.PropertyCurrentUsageType),
    propertyType: str(propDetail.PropertyExistingCleanEnergyLienKnownIndicator)
      ? null
      : str(propDetail.ConstructionMethodType) || str(propDetail.AttachmentType),
    numUnits: int(propDetail.FinancedUnitCount),
    purchasePrice: num(dig(salesContracts[0], 'SALES_CONTRACT_DETAIL', 'SalesContractAmount')),
    estimatedValue: num(propDetail.PropertyEstimatedValueAmount),
  };
}

// ─── Extract Address ──────────────────────────────────────

function extractAddress(addr) {
  if (!addr) return null;
  const street = str(addr.AddressLineText);
  const city = str(addr.CityName);
  const state = str(addr.StateCode);
  const zip = str(addr.PostalCode);
  if (!street && !city) return null;
  return { street, city, state, zip };
}

// ─── Extract Employment ───────────────────────────────────

function extractEmployment(employer) {
  if (!employer) return {};
  const detail = dig(employer, 'EMPLOYER_DETAIL') || employer;
  return {
    employmentStatus: mapEmploymentStatus(str(detail.EmploymentStatusType)),
    employerName: str(detail.EmployerName) || str(employer.NAME?.FullName),
    positionTitle: str(detail.PositionDescription) || str(detail.EmploymentPositionDescription),
    yearsInPosition: int(detail.EmploymentTimeInLineOfWorkYearsCount),
  };
}

// ─── Extract Income ───────────────────────────────────────

function extractIncome(items) {
  let monthlyBaseIncome = null;
  let otherMonthlyIncome = null;
  let otherIncomeSource = null;

  for (const item of items) {
    const detail = dig(item, 'CURRENT_INCOME_ITEM_DETAIL') || item;
    const type = str(detail.IncomeType) || str(detail.CurrentIncomeMonthlyTotalAmount ? 'Base' : '');
    const amount = num(detail.CurrentIncomeMonthlyTotalAmount);

    if (!amount) continue;

    if (type === 'Base' || type === 'MilitaryBasePay') {
      monthlyBaseIncome = (monthlyBaseIncome || 0) + amount;
    } else {
      otherMonthlyIncome = (otherMonthlyIncome || 0) + amount;
      if (!otherIncomeSource) {
        otherIncomeSource = type;
      }
    }
  }

  return { monthlyBaseIncome, otherMonthlyIncome, otherIncomeSource };
}

// ─── Extract Declarations ─────────────────────────────────

function extractDeclarations(decl) {
  if (!decl) return null;

  return {
    // Section 5a — Property & Money
    undisclosedBorrowing: toBool(decl.UndisclosedBorrowedFundsIndicator),
    applyingForOtherMortgage: toBool(decl.IntentToOccupyType === 'No' ? false : decl.UndisclosedMortgageApplicationIndicator),
    priorityLien: toBool(decl.PriorPropertyDeedInLieuConveyedIndicator),

    // Section 5b — Finances
    coSignerOnDebt: toBool(decl.UndisclosedComakerOfNoteIndicator),
    outstandingJudgments: toBool(decl.OutstandingJudgmentsIndicator),
    delinquentFederalDebt: toBool(decl.PartyToLawsuitIndicator),
    lawsuitParty: toBool(decl.PartyToLawsuitIndicator),
    bankruptcy: toBool(decl.BankruptcyIndicator),
    foreclosure: toBool(decl.PropertyForeclosedPastSevenYearsIndicator),

    // Citizenship
    citizenshipStatus: mapCitizenship(str(decl.CitizenshipResidencyType)),
  };
}

// ─── Value Mappers ────────────────────────────────────────

function toBool(val) {
  if (val === true || val === 'true' || val === 'Y' || val === 'Yes') return true;
  if (val === false || val === 'false' || val === 'N' || val === 'No') return false;
  return false;
}

function mapPurpose(raw) {
  const upper = (raw || '').toUpperCase();
  if (upper.includes('PURCHASE')) return 'purchase';
  if (upper.includes('REFINANCE') || upper.includes('REFI')) return 'refinance';
  if (upper.includes('CASHOUT') || upper.includes('CASH_OUT') || upper.includes('CASH-OUT')) return 'refinance';
  return raw?.toLowerCase() || null;
}

function mapLoanType(raw) {
  const upper = (raw || '').toUpperCase();
  if (upper.includes('CONVENTIONAL') || upper === 'FIXED' || upper.includes('CONF')) return 'conventional';
  if (upper.includes('FHA')) return 'fha';
  if (upper.includes('VA')) return 'va';
  if (upper.includes('USDA') || upper.includes('RURAL')) return 'usda';
  return raw?.toLowerCase() || null;
}

function mapOccupancy(raw) {
  const upper = (raw || '').toUpperCase();
  if (upper.includes('PRIMARY') || upper.includes('PRINCIPAL')) return 'primary';
  if (upper.includes('SECOND') || upper.includes('VACATION')) return 'secondary';
  if (upper.includes('INVEST')) return 'investment';
  return raw?.toLowerCase() || null;
}

function mapPropertyType(raw) {
  const upper = (raw || '').toUpperCase();
  if (upper.includes('SINGLE') || upper.includes('SFR') || upper.includes('DETACHED')) return 'single_family';
  if (upper.includes('CONDO')) return 'condo';
  if (upper.includes('TOWN')) return 'townhouse';
  if (upper.includes('MULTI') || upper.includes('2UNIT') || upper.includes('3UNIT') || upper.includes('4UNIT')) return 'multi_unit';
  if (upper.includes('MANUFACTURED') || upper.includes('MOBILE')) return 'manufactured';
  return raw?.toLowerCase() || null;
}

function mapEmploymentStatus(raw) {
  const upper = (raw || '').toUpperCase();
  if (upper.includes('CURRENT') || upper === 'EMPLOYED') return 'employed';
  if (upper.includes('SELF')) return 'self_employed';
  if (upper.includes('RETIRE')) return 'retired';
  if (upper.includes('NOT') || upper === 'UNEMPLOYED') return 'not_employed';
  return raw?.toLowerCase() || null;
}

function mapMaritalStatus(raw) {
  const upper = (raw || '').toUpperCase();
  if (upper.includes('MARRIED') && !upper.includes('UN')) return 'married';
  if (upper.includes('UNMARRIED') || upper.includes('SINGLE') || upper.includes('DOMESTIC')) return 'unmarried';
  if (upper.includes('SEPARATE')) return 'separated';
  return raw?.toLowerCase() || null;
}

function mapCitizenship(raw) {
  const upper = (raw || '').toUpperCase();
  if (upper.includes('US') || upper.includes('CITIZEN')) return 'us_citizen';
  if (upper.includes('PERMANENT') || upper.includes('RESIDENT')) return 'permanent_resident';
  if (upper.includes('NON')) return 'non_permanent_resident';
  return raw?.toLowerCase() || null;
}
