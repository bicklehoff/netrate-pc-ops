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
      'ASSET', 'LIABILITY', 'RELATIONSHIP',
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

  // ─── Amortization ──────────────────────────────────────
  const amortRule = dig(loanData, 'AMORTIZATION', 'AMORTIZATION_RULE') || {};
  const amortizationType = mapAmortizationType(str(amortRule.AmortizationType));
  // Derive loanTerm from AmortizationPeriodCount if not in TermsOfLoan
  const derivedLoanTerm = loanTerm || int(amortRule.LoanAmortizationPeriodCount);

  // ─── Extract Assets & REOs from DEAL level ──────────────
  const rawAssets = toArray(dig(deal, 'ASSETS', 'ASSET'));
  const assets = [];
  const reos = [];

  // Build relationship map (ASSET label → BORROWER label)
  const relationships = toArray(dig(deal, 'RELATIONSHIPS', 'RELATIONSHIP'));
  const assetToBorrowerMap = {};
  for (const rel of relationships) {
    const arcRole = str(rel['@_xlink:arcrole']) || '';
    if (arcRole.includes('ASSET_IsAssociatedWith_ROLE')) {
      assetToBorrowerMap[str(rel['@_xlink:from'])] = str(rel['@_xlink:to']);
    }
  }

  for (const asset of rawAssets) {
    const assetDetail = dig(asset, 'ASSET_DETAIL') || {};
    const assetType = str(assetDetail.AssetType);
    const assetLabel = str(asset['@_xlink:label']);
    const borrowerLabel = assetToBorrowerMap[assetLabel];

    if (assetType === 'RealEstateOwned') {
      // This is an REO, not a financial asset
      const ownedProp = dig(asset, 'OWNED_PROPERTY') || {};
      const ownedDetail = dig(ownedProp, 'OWNED_PROPERTY_DETAIL') || {};
      const propAddr = extractAddress(dig(ownedProp, 'PROPERTY', 'ADDRESS'));
      const propDetail = dig(ownedProp, 'PROPERTY', 'PROPERTY_DETAIL') || {};

      reos.push({
        address: propAddr,
        propertyType: mapPropertyType(str(propDetail.ConstructionMethodType) || str(propDetail.AttachmentType)),
        presentMarketValue: num(ownedDetail.OwnedPropertyMarketValueAmount),
        mortgageBalance: num(ownedDetail.OwnedPropertyMortgageAmount),
        mortgagePayment: num(ownedDetail.OwnedPropertyMortgagePaymentAmount),
        grossRentalIncome: num(ownedDetail.OwnedPropertyRentalIncomeGrossAmount),
        netRentalIncome: num(ownedDetail.OwnedPropertyRentalIncomeNetAmount),
        insuranceTaxesMaintenance: num(ownedDetail.OwnedPropertyMaintenanceExpenseAmount),
        status: mapReoStatus(str(ownedDetail.OwnedPropertyDispositionStatusType)),
        borrowerLabel,
      });
    } else {
      // Financial asset
      assets.push({
        institution: str(assetDetail.AssetAccountIdentifier) ? null : null, // MISMO doesn't always have institution
        accountType: mapAccountType(assetType),
        accountNumber: str(assetDetail.AssetAccountIdentifier),
        balance: num(assetDetail.AssetCashOrMarketValueAmount),
        borrowerLabel,
      });
    }
  }

  // ─── Extract Liabilities from DEAL level ────────────────
  const rawLiabilities = toArray(dig(deal, 'LIABILITIES', 'LIABILITY'));
  const liabilities = rawLiabilities.map((liab) => {
    const liabDetail = dig(liab, 'LIABILITY_DETAIL') || {};
    return {
      creditor: str(liabDetail.LiabilityHolderName),
      accountNumber: str(liabDetail.LiabilityAccountIdentifier),
      liabilityType: mapLiabilityType(str(liabDetail.LiabilityType)),
      monthlyPayment: num(liabDetail.LiabilityMonthlyPaymentAmount),
      unpaidBalance: num(liabDetail.LiabilityUnpaidBalanceAmount),
      monthsRemaining: int(liabDetail.LiabilityPaymentRemainingCount),
      paidOffAtClosing: toBool(liabDetail.LiabilityPayoffStatusIndicator),
    };
  });

  // ─── Extract Transaction Details from URLA ──────────────
  const urla = dig(loanData, 'DOCUMENT_SPECIFIC_DATA_SETS', 'DOCUMENT_SPECIFIC_DATA_SET', 'URLA') || {};
  const urlaDetail = dig(urla, 'URLA_DETAIL') || {};
  const closingInfo = dig(loanData, 'CLOSING_INFORMATION', 'CLOSING_INFORMATION_DETAIL') || {};

  const transaction = {
    purchasePrice: property.purchasePrice,
    closingCostsEstimate: num(urlaDetail.EstimatedClosingCostsAmount),
    discountPoints: num(dig(loanProduct, 'DiscountPointsTotalAmount')),
    sellerConcessions: num(dig(urla, 'URLA_TOTAL', 'EXTENSION', 'OTHER', 'URLA_TOTAL_EXTENSION', 'URLATotalSellerCreditsAmount')),
    cashFromBorrower: num(closingInfo.CashFromBorrowerAtClosingAmount),
  };

  // ─── Build Result ───────────────────────────────────────
  return {
    loan: {
      loanNumber,
      purpose,
      loanType,
      loanAmount,
      interestRate,
      loanTerm: derivedLoanTerm,
      lenderName,
      presentHousingExpense,
      occupancy: mapOccupancy(str(property.occupancy)),
      propertyType: mapPropertyType(str(property.propertyType)),
      numUnits: property.numUnits,
      purchasePrice: property.purchasePrice,
      estimatedValue: property.estimatedValue,
      amortizationType,
    },
    borrowers,
    property: {
      address: property.address,
    },
    // 1003 models
    assets,
    liabilities,
    reos,
    transaction,
    // Convenience: primary borrower (first one)
    primaryBorrower: borrowers[0] || null,
    coBorrowers: borrowers.slice(1),
    // Stats for preview
    stats: {
      dealCount: deals.length,
      partyCount: parties.length,
      borrowerCount: borrowers.length,
      assetCount: assets.length,
      liabilityCount: liabilities.length,
      reoCount: reos.length,
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
  let cellPhone = null;
  for (const cp of contactPoints) {
    if (cp.CONTACT_POINT_EMAIL) {
      email = str(dig(cp, 'CONTACT_POINT_EMAIL', 'ContactPointEmailValue')) || email;
    }
    if (cp.CONTACT_POINT_TELEPHONE) {
      const phoneVal = str(dig(cp, 'CONTACT_POINT_TELEPHONE', 'ContactPointTelephoneValue'));
      const roleType = str(dig(cp, 'CONTACT_POINT_DETAIL', 'ContactPointRoleType'));
      if (roleType === 'Mobile' || roleType === 'Cell') {
        cellPhone = phoneVal || cellPhone;
      }
      phone = phoneVal || phone;
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
  if (!ssn && taxpayerIds.length > 0) {
    ssn = str(taxpayerIds[0].TaxpayerIdentifierValue);
  }

  // Extract DOB
  const dob = str(borrowerDetail.BorrowerBirthDate)
    || str(party.BIRTH_DATE)
    || str(dig(party, 'INDIVIDUAL', 'BIRTH_DATE'));

  // Extract residences
  const residences = toArray(dig(role, 'BORROWER', 'RESIDENCES', 'RESIDENCE'));
  const currentResidence = residences.find(
    (r) => str(dig(r, 'RESIDENCE_DETAIL', 'BorrowerResidencyType')) === 'Current'
  ) || residences[0];
  const priorResidence = residences.find(
    (r) => str(dig(r, 'RESIDENCE_DETAIL', 'BorrowerResidencyType')) === 'Prior'
  );

  const address = extractAddress(dig(currentResidence, 'ADDRESS'));
  const currentDetail = dig(currentResidence, 'RESIDENCE_DETAIL') || {};
  const addressMonths = int(currentDetail.BorrowerResidencyDurationMonthsCount);
  const addressYears = int(currentDetail.BorrowerResidencyDurationYearsCount)
    || (addressMonths ? Math.floor(addressMonths / 12) : null);

  // Housing type from residence
  const housingType = mapHousingType(str(currentDetail.BorrowerResidencyBasisType));
  const monthlyRent = num(dig(currentResidence, 'LANDLORD', 'LANDLORD_DETAIL', 'MonthlyRentAmount'));

  // Previous address
  const previousAddress = priorResidence ? extractAddress(dig(priorResidence, 'ADDRESS')) : null;
  const priorDetail = dig(priorResidence, 'RESIDENCE_DETAIL') || {};
  const prevMonths = int(priorDetail.BorrowerResidencyDurationMonthsCount);
  const previousAddressYears = int(priorDetail.BorrowerResidencyDurationYearsCount)
    || (prevMonths ? Math.floor(prevMonths / 12) : null);
  const previousAddressMonths = prevMonths ? (prevMonths % 12) : null;

  // Extract ALL employments (not just current)
  const employers = toArray(dig(role, 'BORROWER', 'EMPLOYERS', 'EMPLOYER'));
  const employments = employers.map((emp) => extractFullEmployment(emp));

  // Current employer for backward-compat flat fields
  const currentEmployer = employers.find(
    (e) => str(dig(e, 'EMPLOYMENT', 'EmploymentStatusType')) === 'Current'
      || str(dig(e, 'EMPLOYMENT', 'EmploymentClassificationType')) === 'Primary'
  ) || employers[0];
  const employment = extractEmployment(currentEmployer);

  // Extract detailed income (by type)
  const incomeItems = toArray(
    dig(role, 'BORROWER', 'CURRENT_INCOME', 'CURRENT_INCOME_ITEMS', 'CURRENT_INCOME_ITEM')
  );
  const income = extractIncome(incomeItems);
  const detailedIncome = extractDetailedIncome(incomeItems);

  // Extract declarations (structured for LoanDeclaration model)
  const declDetail = dig(role, 'BORROWER', 'DECLARATION', 'DECLARATION_DETAIL') || {};
  const declarations = extractDeclarations(declDetail);
  const structuredDeclaration = extractStructuredDeclaration(declDetail);

  // Citizenship
  const citizenship = mapCitizenship(str(declDetail.CitizenshipResidencyType));

  // Marital status
  const maritalStatus = mapMaritalStatus(str(borrowerDetail.MaritalStatusType));

  // xlink label for relationship mapping
  const roleLabel = str(role['@_xlink:label']);

  return {
    ordinal: index,
    borrowerType: index === 0 ? 'primary' : 'co_borrower',
    roleLabel,
    firstName: str(name.FirstName),
    lastName: str(name.LastName),
    middleName: str(name.MiddleName),
    suffix: str(name.SuffixName),
    email,
    phone,
    cellPhone,
    ssn: ssn ? ssn.replace(/\D/g, '') : null,
    dob,
    maritalStatus,
    citizenship,
    housingType,
    monthlyRent,
    currentAddress: address,
    addressYears,
    addressMonths,
    previousAddress,
    previousAddressYears,
    previousAddressMonths,
    // Flat employment (backward compat)
    ...employment,
    ...income,
    declarations,
    // Full 1003 data
    employments,
    detailedIncome,
    structuredDeclaration,
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
  if (upper.includes('SINGLE') || upper.includes('SFR') || upper.includes('DETACHED')) return 'sfr';
  if (upper.includes('CONDO')) return 'condo';
  if (upper.includes('TOWN')) return 'townhome';
  if (upper.includes('MULTI') || upper.includes('2UNIT') || upper.includes('3UNIT') || upper.includes('4UNIT')) return 'multi_unit';
  if (upper.includes('MANUFACTURED') || upper.includes('MOBILE')) return 'manufactured';
  if (upper.includes('PUD')) return 'pud';
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
  if (upper.includes('USCITIZEN') || upper === 'US_CITIZEN') return 'us_citizen';
  if (upper.includes('US') && upper.includes('CITIZEN')) return 'us_citizen';
  if (upper.includes('PERMANENT') || upper.includes('RESIDENT')) return 'permanent_resident';
  if (upper.includes('NON')) return 'non_permanent_resident';
  return raw?.toLowerCase() || null;
}

// ─── Full Employment Extraction (for LoanEmployment model) ─

function extractFullEmployment(employer) {
  if (!employer) return null;
  const emp = dig(employer, 'EMPLOYMENT') || {};
  const legalEntity = dig(employer, 'LEGAL_ENTITY') || {};
  const empName = str(dig(legalEntity, 'LEGAL_ENTITY_DETAIL', 'FullName'))
    || str(dig(employer, 'EMPLOYER_DETAIL', 'EmployerName'));
  const addr = extractAddress(dig(employer, 'ADDRESS'));
  const empPhone = str(dig(legalEntity, 'CONTACTS', 'CONTACT', 'CONTACT_POINTS', 'CONTACT_POINT', 'CONTACT_POINT_TELEPHONE', 'ContactPointTelephoneValue'));

  const classification = str(emp.EmploymentClassificationType);
  const isPrimary = classification === 'Primary' || classification === 'Current'
    || str(emp.EmploymentStatusType) === 'Current';

  return {
    isPrimary,
    employerName: empName,
    employerAddress: addr,
    employerPhone: empPhone,
    position: str(emp.EmploymentPositionDescription),
    startDate: str(emp.EmploymentStartDate),
    endDate: str(emp.EmploymentEndDate),
    yearsOnJob: null, // Calculated from dates
    monthsOnJob: int(emp.EmploymentTimeInLineOfWorkMonthsCount),
    selfEmployed: toBool(emp.EmploymentBorrowerSelfEmployedIndicator),
  };
}

// ─── Detailed Income (for LoanIncome model) ──────────────

function extractDetailedIncome(items) {
  const income = {
    baseMonthly: null,
    overtimeMonthly: null,
    bonusMonthly: null,
    commissionMonthly: null,
    dividendsMonthly: null,
    interestMonthly: null,
    rentalIncomeMonthly: null,
    otherMonthly: null,
    otherIncomeSource: null,
  };

  for (const item of items) {
    const detail = dig(item, 'CURRENT_INCOME_ITEM_DETAIL') || item;
    const type = str(detail.IncomeType);
    const amount = num(detail.CurrentIncomeMonthlyTotalAmount);
    if (!amount) continue;

    switch (type) {
      case 'Base':
      case 'MilitaryBasePay':
        income.baseMonthly = (income.baseMonthly || 0) + amount;
        break;
      case 'Overtime':
        income.overtimeMonthly = (income.overtimeMonthly || 0) + amount;
        break;
      case 'Bonus':
        income.bonusMonthly = (income.bonusMonthly || 0) + amount;
        break;
      case 'Commissions':
      case 'Commission':
        income.commissionMonthly = (income.commissionMonthly || 0) + amount;
        break;
      case 'DividendsInterest':
      case 'Dividends':
        income.dividendsMonthly = (income.dividendsMonthly || 0) + amount;
        break;
      case 'Interest':
        income.interestMonthly = (income.interestMonthly || 0) + amount;
        break;
      case 'NetRentalIncome':
      case 'RentalIncome':
        income.rentalIncomeMonthly = (income.rentalIncomeMonthly || 0) + amount;
        break;
      default:
        income.otherMonthly = (income.otherMonthly || 0) + amount;
        if (!income.otherIncomeSource) income.otherIncomeSource = type;
        break;
    }
  }

  return income;
}

// ─── Structured Declaration (for LoanDeclaration model) ───

function extractStructuredDeclaration(decl) {
  if (!decl) return null;

  return {
    outstandingJudgments: toBool(decl.OutstandingJudgmentsIndicator),
    bankruptcy: toBool(decl.BankruptcyIndicator),
    bankruptcyType: str(decl.BankruptcyChapterType),
    foreclosure: toBool(decl.PriorPropertyForeclosureCompletedIndicator),
    partyToLawsuit: toBool(decl.PartyToLawsuitIndicator),
    loanDefault: toBool(decl.PresentlyDelinquentIndicator),
    alimonyObligation: false, // Not directly in MISMO standard declarations
    delinquentFederalDebt: toBool(decl.PresentlyDelinquentIndicator),
    coSignerOnOtherLoan: toBool(decl.UndisclosedComakerOfNoteIndicator),
    intentToOccupy: str(decl.IntentToOccupyType) === 'Yes',
    ownershipInterestLastThreeYears: str(decl.HomeownerPastThreeYearsType) === 'Yes',
    propertyTypeOfOwnership: str(decl.PriorPropertyTitleType),
  };
}

// ─── Additional Mappers ──────────────────────────────────

function mapHousingType(raw) {
  const upper = (raw || '').toUpperCase();
  if (upper.includes('OWN')) return 'own';
  if (upper.includes('RENT')) return 'rent';
  if (upper.includes('FREE') || upper.includes('LIVING')) return 'free';
  return null;
}

function mapAmortizationType(raw) {
  const upper = (raw || '').toUpperCase();
  if (upper.includes('FIXED')) return 'fixed';
  if (upper.includes('ARM') || upper.includes('ADJUSTABLE')) return 'arm';
  if (upper.includes('BALLOON')) return 'balloon';
  return null;
}

function mapAccountType(raw) {
  const upper = (raw || '').toUpperCase();
  if (upper.includes('CHECK')) return 'checking';
  if (upper.includes('SAVING')) return 'savings';
  if (upper.includes('CD') || upper.includes('CERTIFICATE')) return 'cd';
  if (upper.includes('STOCK') || upper.includes('BOND') || upper.includes('MUTUAL')) return 'stocks';
  if (upper.includes('RETIRE') || upper.includes('401K') || upper.includes('IRA')) return 'retirement';
  return 'other';
}

function mapLiabilityType(raw) {
  const upper = (raw || '').toUpperCase();
  if (upper.includes('REVOLV')) return 'revolving';
  if (upper.includes('INSTALL')) return 'installment';
  if (upper.includes('MORTGAGE') || upper.includes('HELOC')) return 'mortgage';
  if (upper.includes('COLLECT')) return 'collection';
  return 'other';
}

function mapReoStatus(raw) {
  const upper = (raw || '').toUpperCase();
  if (upper.includes('RETAIN')) return 'retained';
  if (upper.includes('SOLD')) return 'sold';
  if (upper.includes('PENDING')) return 'pending_sale';
  return 'retained';
}
