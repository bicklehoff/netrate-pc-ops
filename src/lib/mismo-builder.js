// MISMO 3.4 XML Builder
// Generates MISMO 3.4 (ULAD) compliant XML from Core loan data.
// Used for: LenDox AUS submission, lender submission packages, audit snapshots.
//
// Input: Full loan object with all 1003 relations included.
// Output: XML string ready for download or Blob storage.

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtDate(date) {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
}

function fmtAmount(val) {
  if (val == null) return '';
  return Number(val).toFixed(2);
}

function tag(name, value) {
  if (value == null || value === '') return '';
  return `<${name}>${esc(String(value))}</${name}>`;
}

function boolTag(name, value) {
  if (value == null) return '';
  return `<${name}>${value ? 'true' : 'false'}</${name}>`;
}

// ─── Purpose/Type Mappers (Core → MISMO) ─────────────────

function mismoLoanPurpose(purpose) {
  const map = { purchase: 'Purchase', refinance: 'Refinance', cash_out: 'CashOut' };
  return map[purpose] || 'Purchase';
}

function mismoMortgageType(loanType) {
  const map = { conventional: 'Conventional', fha: 'FHA', va: 'VA', usda: 'USDA' };
  return map[loanType] || 'Conventional';
}

function mismoAmortType(type) {
  const map = { fixed: 'Fixed', arm: 'AdjustableRate', balloon: 'Balloon' };
  return map[type] || 'Fixed';
}

function mismoOccupancy(occ) {
  const map = { primary: 'PrimaryResidence', secondary: 'SecondHome', investment: 'Investment' };
  return map[occ] || 'PrimaryResidence';
}

function mismoPropertyType(type) {
  const map = {
    single_family: 'Detached', condo: 'Condominium', townhouse: 'Attached',
    multi_unit: 'Detached', manufactured: 'ManufacturedHousing',
  };
  return map[type] || 'Detached';
}

function mismoMaritalStatus(status) {
  const map = { married: 'Married', unmarried: 'Unmarried', separated: 'Separated' };
  return map[status] || '';
}

function mismoCitizenship(cit) {
  const map = { us_citizen: 'USCitizen', permanent_resident: 'PermanentResidentAlien', non_permanent_resident: 'NonPermanentResidentAlien' };
  return map[cit] || '';
}

function mismoHousingType(type) {
  const map = { own: 'Own', rent: 'Rent', free: 'LivingRentFree' };
  return map[type] || '';
}

function mismoAccountType(type) {
  const map = {
    checking: 'CheckingAccount', savings: 'SavingsAccount', cd: 'CertificateOfDepositTimeDeposit',
    stocks: 'Stock', retirement: 'RetirementFund', other: 'Other',
  };
  return map[type] || 'Other';
}

function mismoLiabilityType(type) {
  const map = { revolving: 'Revolving', installment: 'Installment', mortgage: 'MortgageLoan', collection: 'Collection', other: 'Other' };
  return map[type] || 'Other';
}

function mismoReoStatus(status) {
  const map = { retained: 'Retain', sold: 'Sold', pending_sale: 'PendingSale' };
  return map[status] || 'Retain';
}

// ─── Address Builder ─────────────────────────────────────

function buildAddress(addr) {
  if (!addr) return '';
  return `<ADDRESS>
  ${tag('AddressLineText', addr.street)}
  ${tag('CityName', addr.city)}
  ${tag('StateCode', addr.state)}
  ${tag('PostalCode', addr.zip)}
  ${tag('CountryCode', 'US')}
</ADDRESS>`;
}

// ─── Main Builder ────────────────────────────────────────

/**
 * Build MISMO 3.4 XML from a full loan object.
 * @param {Object} loan - Loan with all includes (borrower, loanBorrowers with employments/income/declaration, assets, liabilities, reos, transaction, mlo)
 * @param {Object} options - { decryptedBorrowers: [{ borrowerId, ssn, dob }] }
 */
export function buildMismoXml(loan, options = {}) {
  const decrypted = options.decryptedBorrowers || [];
  const loanBorrowers = loan.loanBorrowers || [];
  const now = new Date().toISOString();

  // ─── Build Loan Section ────────────────────────────────
  const loanNumber = loan.loanNumber || loan.lenderLoanNumber || loan.id.substring(0, 8);
  const loanTerm = loan.loanTerm || 360;
  const amortType = mismoAmortType(loan.amortizationType);

  let armXml = '';
  if (loan.amortizationType === 'arm') {
    armXml = `<ADJUSTMENT>
  <ADJUSTMENT_RULE>
    ${tag('PerChangeRateAdjustmentFrequencyMonthsCount', loan.armAdjustmentPeriod)}
  </ADJUSTMENT_RULE>
</ADJUSTMENT>
<ARM>
  <ARM_DETAIL>
    ${tag('IndexType', loan.armIndex)}
    ${tag('ARMMarginRatePercent', loan.armMargin)}
    ${tag('ARMInitialCapPercent', loan.armInitialCap)}
    ${tag('ARMSubsequentCapPercent', loan.armPeriodicCap)}
    ${tag('ARMLifetimeCapPercent', loan.armLifetimeCap)}
  </ARM_DETAIL>
</ARM>`;
  }

  // Housing expenses
  const txn = loan.transaction || {};

  const loanXml = `<LOAN xlink:label="LOAN_1" LoanRoleType="SubjectLoan">
  <AMORTIZATION>
    <AMORTIZATION_RULE>
      ${tag('AmortizationType', amortType)}
      ${tag('LoanAmortizationPeriodCount', loanTerm)}
      <LoanAmortizationPeriodType>Month</LoanAmortizationPeriodType>
    </AMORTIZATION_RULE>
  </AMORTIZATION>
  ${armXml}
  <CLOSING_INFORMATION>
    <CLOSING_INFORMATION_DETAIL>
      ${tag('CashFromBorrowerAtClosingAmount', fmtAmount(txn.cashFromBorrower))}
    </CLOSING_INFORMATION_DETAIL>
  </CLOSING_INFORMATION>
  <DOCUMENT_SPECIFIC_DATA_SETS>
    <DOCUMENT_SPECIFIC_DATA_SET>
      <URLA>
        <URLA_DETAIL>
          ${tag('EstimatedClosingCostsAmount', fmtAmount(txn.closingCostsEstimate))}
        </URLA_DETAIL>
      </URLA>
    </DOCUMENT_SPECIFIC_DATA_SET>
  </DOCUMENT_SPECIFIC_DATA_SETS>
  <LOAN_DETAIL>
    ${tag('BorrowerCount', loanBorrowers.length || 1)}
    ${boolTag('InterestOnlyIndicator', false)}
    ${boolTag('BalloonIndicator', loan.amortizationType === 'balloon')}
  </LOAN_DETAIL>
  <LOAN_IDENTIFIERS>
    <LOAN_IDENTIFIER>
      ${tag('LoanIdentifier', loanNumber)}
      <LoanIdentifierType>LenderLoan</LoanIdentifierType>
    </LOAN_IDENTIFIER>
  </LOAN_IDENTIFIERS>
  <LOAN_PRODUCT>
    <LOAN_PRODUCT_DETAIL>
      ${tag('DiscountPointsTotalAmount', fmtAmount(txn.discountPoints))}
    </LOAN_PRODUCT_DETAIL>
  </LOAN_PRODUCT>
  <ORIGINATION_SYSTEMS>
    <ORIGINATION_SYSTEM>
      <LoanOriginationSystemName>NetRate Core</LoanOriginationSystemName>
      <LoanOriginationSystemVersionIdentifier>1.0</LoanOriginationSystemVersionIdentifier>
    </ORIGINATION_SYSTEM>
  </ORIGINATION_SYSTEMS>
  <TERMS_OF_LOAN>
    ${tag('BaseLoanAmount', fmtAmount(loan.loanAmount))}
    ${tag('LienPriorityType', 'FirstLien')}
    ${tag('LoanPurposeType', mismoLoanPurpose(loan.purpose))}
    ${tag('MortgageType', mismoMortgageType(loan.loanType))}
    ${tag('NoteRatePercent', loan.interestRate)}
  </TERMS_OF_LOAN>
</LOAN>`;

  // ─── Build Party (Borrower) Sections ───────────────────
  const partyXmls = [];
  let borrowerIdx = 0;

  for (const lb of loanBorrowers) {
    borrowerIdx++;
    const borr = lb.borrower || {};
    const decr = decrypted.find((d) => d.borrowerId === borr.id) || {};
    const label = `BORROWER_${borrowerIdx}`;

    // Contact points
    const contactPoints = [];
    if (borr.email) {
      contactPoints.push(`<CONTACT_POINT><CONTACT_POINT_EMAIL>${tag('ContactPointEmailValue', borr.email)}</CONTACT_POINT_EMAIL></CONTACT_POINT>`);
    }
    if (borr.phone) {
      contactPoints.push(`<CONTACT_POINT><CONTACT_POINT_TELEPHONE>${tag('ContactPointTelephoneValue', borr.phone)}</CONTACT_POINT_TELEPHONE><CONTACT_POINT_DETAIL><ContactPointRoleType>Home</ContactPointRoleType></CONTACT_POINT_DETAIL></CONTACT_POINT>`);
    }
    if (lb.cellPhone) {
      contactPoints.push(`<CONTACT_POINT><CONTACT_POINT_TELEPHONE>${tag('ContactPointTelephoneValue', lb.cellPhone)}</CONTACT_POINT_TELEPHONE><CONTACT_POINT_DETAIL><ContactPointRoleType>Mobile</ContactPointRoleType></CONTACT_POINT_DETAIL></CONTACT_POINT>`);
    }

    // Employments
    const empXmls = (lb.employments || []).map((emp, ei) => {
      const empLabel = `EMPLOYER_${borrowerIdx}_${ei + 1}`;
      const classification = emp.isPrimary ? 'Primary' : 'Secondary';
      return `<EMPLOYER SequenceNumber="${ei + 1}" xlink:label="${empLabel}">
  <LEGAL_ENTITY>
    ${emp.employerPhone ? `<CONTACTS><CONTACT><CONTACT_POINTS><CONTACT_POINT><CONTACT_POINT_TELEPHONE>${tag('ContactPointTelephoneValue', emp.employerPhone)}</CONTACT_POINT_TELEPHONE></CONTACT_POINT></CONTACT_POINTS></CONTACT></CONTACTS>` : ''}
    <LEGAL_ENTITY_DETAIL>${tag('FullName', emp.employerName)}</LEGAL_ENTITY_DETAIL>
  </LEGAL_ENTITY>
  ${emp.employerAddress ? buildAddress(emp.employerAddress) : ''}
  <EMPLOYMENT>
    ${boolTag('EmploymentBorrowerSelfEmployedIndicator', emp.selfEmployed)}
    ${tag('EmploymentClassificationType', classification)}
    ${tag('EmploymentPositionDescription', emp.position)}
    ${tag('EmploymentStartDate', fmtDate(emp.startDate))}
    ${emp.endDate ? tag('EmploymentEndDate', fmtDate(emp.endDate)) : ''}
    <EmploymentStatusType>${emp.isPrimary ? 'Current' : 'Previous'}</EmploymentStatusType>
    ${emp.monthsOnJob ? tag('EmploymentTimeInLineOfWorkMonthsCount', emp.monthsOnJob) : ''}
  </EMPLOYMENT>
</EMPLOYER>`;
    });

    // Income items
    const incomeXmls = [];
    const inc = lb.income || {};
    let incIdx = 0;
    const addIncome = (type, amount) => {
      if (!amount) return;
      incIdx++;
      incomeXmls.push(`<CURRENT_INCOME_ITEM SequenceNumber="${incIdx}"><CURRENT_INCOME_ITEM_DETAIL>
  ${tag('CurrentIncomeMonthlyTotalAmount', fmtAmount(amount))}
  ${boolTag('EmploymentIncomeIndicator', type === 'Base' || type === 'Overtime' || type === 'Bonus' || type === 'Commissions')}
  ${tag('IncomeType', type)}
</CURRENT_INCOME_ITEM_DETAIL></CURRENT_INCOME_ITEM>`);
    };
    addIncome('Base', inc.baseMonthly);
    addIncome('Overtime', inc.overtimeMonthly);
    addIncome('Bonus', inc.bonusMonthly);
    addIncome('Commissions', inc.commissionMonthly);
    addIncome('DividendsInterest', inc.dividendsMonthly);
    addIncome('Interest', inc.interestMonthly);
    addIncome('NetRentalIncome', inc.rentalIncomeMonthly);
    if (inc.otherMonthly) addIncome(inc.otherIncomeSource || 'Other', inc.otherMonthly);

    // Declarations
    const decl = lb.declaration || {};
    const declXml = `<DECLARATION><DECLARATION_DETAIL>
  ${boolTag('BankruptcyIndicator', decl.bankruptcy)}
  ${tag('CitizenshipResidencyType', mismoCitizenship(lb.citizenship))}
  ${tag('HomeownerPastThreeYearsType', decl.ownershipInterestLastThreeYears ? 'Yes' : 'No')}
  ${tag('IntentToOccupyType', decl.intentToOccupy ? 'Yes' : 'No')}
  ${boolTag('OutstandingJudgmentsIndicator', decl.outstandingJudgments)}
  ${boolTag('PartyToLawsuitIndicator', decl.partyToLawsuit)}
  ${boolTag('PresentlyDelinquentIndicator', decl.loanDefault)}
  ${boolTag('PriorPropertyForeclosureCompletedIndicator', decl.foreclosure)}
  ${boolTag('UndisclosedBorrowedFundsIndicator', false)}
  ${boolTag('UndisclosedComakerOfNoteIndicator', decl.coSignerOnOtherLoan)}
  ${boolTag('UndisclosedCreditApplicationIndicator', false)}
  ${boolTag('UndisclosedMortgageApplicationIndicator', false)}
</DECLARATION_DETAIL></DECLARATION>`;

    // Residences
    const residences = [];
    if (lb.currentAddress) {
      const basisType = mismoHousingType(lb.housingType);
      const totalMonths = (lb.addressYears || 0) * 12 + (lb.addressMonths || 0);
      residences.push(`<RESIDENCE>
  ${buildAddress(lb.currentAddress)}
  ${lb.monthlyRent ? `<LANDLORD><LANDLORD_DETAIL>${tag('MonthlyRentAmount', fmtAmount(lb.monthlyRent))}</LANDLORD_DETAIL></LANDLORD>` : ''}
  <RESIDENCE_DETAIL>
    ${tag('BorrowerResidencyBasisType', basisType)}
    ${totalMonths ? tag('BorrowerResidencyDurationMonthsCount', totalMonths) : ''}
    <BorrowerResidencyType>Current</BorrowerResidencyType>
  </RESIDENCE_DETAIL>
</RESIDENCE>`);
    }
    if (lb.previousAddress) {
      const prevMonths = (lb.previousAddressYears || 0) * 12 + (lb.previousAddressMonths || 0);
      residences.push(`<RESIDENCE>
  ${buildAddress(lb.previousAddress)}
  <RESIDENCE_DETAIL>
    ${tag('BorrowerResidencyBasisType', '')}
    ${prevMonths ? tag('BorrowerResidencyDurationMonthsCount', prevMonths) : ''}
    <BorrowerResidencyType>Prior</BorrowerResidencyType>
  </RESIDENCE_DETAIL>
</RESIDENCE>`);
    }

    const partyXml = `<PARTY>
  <INDIVIDUAL>
    <CONTACT_POINTS>${contactPoints.join('\n')}</CONTACT_POINTS>
    <NAME>
      ${tag('FirstName', borr.firstName)}
      ${lb.suffix ? tag('SuffixName', lb.suffix) : ''}
      ${tag('LastName', borr.lastName)}
    </NAME>
  </INDIVIDUAL>
  ${lb.mailingAddress ? `<ADDRESSES><ADDRESS>${buildAddress(lb.mailingAddress)}<AddressType>Mailing</AddressType></ADDRESS></ADDRESSES>` : ''}
  <ROLES>
    <ROLE SequenceNumber="${borrowerIdx}" xlink:label="${label}">
      <BORROWER>
        <BORROWER_DETAIL>
          ${decr.dob ? tag('BorrowerBirthDate', decr.dob) : ''}
          ${tag('MaritalStatusType', mismoMaritalStatus(lb.maritalStatus))}
        </BORROWER_DETAIL>
        <CURRENT_INCOME>
          <CURRENT_INCOME_ITEMS>${incomeXmls.join('\n')}</CURRENT_INCOME_ITEMS>
        </CURRENT_INCOME>
        ${declXml}
        <EMPLOYERS>${empXmls.join('\n')}</EMPLOYERS>
        <RESIDENCES>${residences.join('\n')}</RESIDENCES>
      </BORROWER>
      <ROLE_DETAIL><PartyRoleType>Borrower</PartyRoleType></ROLE_DETAIL>
    </ROLE>
  </ROLES>
  <TAXPAYER_IDENTIFIERS>
    <TAXPAYER_IDENTIFIER>
      <TaxpayerIdentifierType>SocialSecurityNumber</TaxpayerIdentifierType>
      ${tag('TaxpayerIdentifierValue', decr.ssn || '')}
    </TAXPAYER_IDENTIFIER>
  </TAXPAYER_IDENTIFIERS>
</PARTY>`;

    partyXmls.push(partyXml);
  }

  // ─── Loan Originator Party ─────────────────────────────
  if (loan.mlo) {
    partyXmls.push(`<PARTY>
  <INDIVIDUAL>
    <NAME><FullName>${esc(loan.mlo.firstName)} ${esc(loan.mlo.lastName)}</FullName></NAME>
  </INDIVIDUAL>
  <ROLES>
    <ROLE>
      <ROLE_DETAIL><PartyRoleType>LoanOriginator</PartyRoleType></ROLE_DETAIL>
    </ROLE>
  </ROLES>
</PARTY>`);
  }

  // ─── Loan Origination Company ──────────────────────────
  partyXmls.push(`<PARTY>
  <LEGAL_ENTITY>
    <LEGAL_ENTITY_DETAIL><FullName>NetRate Mortgage</FullName></LEGAL_ENTITY_DETAIL>
  </LEGAL_ENTITY>
  <ADDRESSES>
    <ADDRESS>
      <AddressLineText>357 South McCaslin Blvd., #200</AddressLineText>
      <CityName>Louisville</CityName>
      <StateCode>CO</StateCode>
      <PostalCode>80027</PostalCode>
    </ADDRESS>
  </ADDRESSES>
  <ROLES>
    <ROLE>
      <LICENSES><LICENSE><LICENSE_DETAIL>
        <LicenseAuthorityLevelType>PublicState</LicenseAuthorityLevelType>
        <LicenseIdentifier>1111861</LicenseIdentifier>
      </LICENSE_DETAIL></LICENSE></LICENSES>
      <ROLE_DETAIL><PartyRoleType>LoanOriginationCompany</PartyRoleType></ROLE_DETAIL>
    </ROLE>
  </ROLES>
</PARTY>`);

  // ─── Assets ────────────────────────────────────────────
  const assetXmls = (loan.assets || []).map((a, i) => {
    const label = `ASSET_${i + 1}`;
    return `<ASSET SequenceNumber="${i + 1}" xlink:label="${label}">
  <ASSET_DETAIL>
    ${tag('AssetCashOrMarketValueAmount', fmtAmount(a.balance))}
    ${tag('AssetType', mismoAccountType(a.accountType))}
    ${a.accountNumber ? tag('AssetAccountIdentifier', a.accountNumber) : ''}
  </ASSET_DETAIL>
</ASSET>`;
  });

  // REOs as assets
  (loan.reos || []).forEach((reo, i) => {
    const label = `ASSET_REO_${i + 1}`;
    assetXmls.push(`<ASSET xlink:label="${label}">
  <ASSET_DETAIL><AssetType>RealEstateOwned</AssetType></ASSET_DETAIL>
  <OWNED_PROPERTY>
    <OWNED_PROPERTY_DETAIL>
      ${tag('OwnedPropertyDispositionStatusType', mismoReoStatus(reo.status))}
      ${tag('OwnedPropertyRentalIncomeGrossAmount', fmtAmount(reo.grossRentalIncome))}
      ${tag('OwnedPropertyRentalIncomeNetAmount', fmtAmount(reo.netRentalIncome))}
    </OWNED_PROPERTY_DETAIL>
    <PROPERTY>
      ${reo.address ? buildAddress(reo.address) : ''}
      <PROPERTY_DETAIL>
        ${tag('PropertyUsageType', 'Investment')}
      </PROPERTY_DETAIL>
    </PROPERTY>
  </OWNED_PROPERTY>
</ASSET>`);
  });

  // ─── Liabilities ───────────────────────────────────────
  const liabXmls = (loan.liabilities || []).map((l) => `<LIABILITY>
  <LIABILITY_DETAIL>
    ${tag('LiabilityAccountIdentifier', l.accountNumber)}
    ${tag('LiabilityHolderName', l.creditor)}
    ${tag('LiabilityMonthlyPaymentAmount', fmtAmount(l.monthlyPayment))}
    ${tag('LiabilityType', mismoLiabilityType(l.liabilityType))}
    ${tag('LiabilityUnpaidBalanceAmount', fmtAmount(l.unpaidBalance))}
    ${l.monthsRemaining ? tag('LiabilityPaymentRemainingCount', l.monthsRemaining) : ''}
    ${boolTag('LiabilityPayoffStatusIndicator', l.paidOffAtClosing)}
  </LIABILITY_DETAIL>
</LIABILITY>`);

  // ─── Collateral (Subject Property) ─────────────────────
  const propAddr = loan.propertyAddress || {};
  const salesAmount = loan.purchasePrice ? `<SALES_CONTRACTS><SALES_CONTRACT><SALES_CONTRACT_DETAIL>${tag('SalesContractAmount', fmtAmount(loan.purchasePrice))}</SALES_CONTRACT_DETAIL></SALES_CONTRACT></SALES_CONTRACTS>` : '';

  const collateralXml = `<COLLATERAL>
  <SUBJECT_PROPERTY>
    ${buildAddress(propAddr)}
    <PROPERTY_DETAIL>
      ${tag('AttachmentType', mismoPropertyType(loan.propertyType))}
      ${tag('FinancedUnitCount', loan.numUnits || 1)}
      ${tag('PropertyUsageType', mismoOccupancy(loan.occupancy))}
    </PROPERTY_DETAIL>
    ${salesAmount}
  </SUBJECT_PROPERTY>
</COLLATERAL>`;

  // ─── Assemble Full Document ────────────────────────────
  return `<?xml version="1.0" encoding="UTF-8"?>
<MESSAGE xmlns="http://www.mismo.org/residential/2009/schemas"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  MISMOReferenceModelIdentifier="3.4.032420160128">
<ABOUT_VERSIONS>
  <ABOUT_VERSION>
    <CreatedDatetime>${now}</CreatedDatetime>
    <DataVersionIdentifier>NetRate Core Export v2</DataVersionIdentifier>
  </ABOUT_VERSION>
</ABOUT_VERSIONS>
<DEAL_SETS>
  <DEAL_SET>
    <DEALS>
      <DEAL>
        <ASSETS>${assetXmls.join('\n')}</ASSETS>
        <COLLATERALS>${collateralXml}</COLLATERALS>
        <LIABILITIES>${liabXmls.join('\n')}</LIABILITIES>
        <LOANS>${loanXml}</LOANS>
        <PARTIES>${partyXmls.join('\n')}</PARTIES>
      </DEAL>
    </DEALS>
  </DEAL_SET>
</DEAL_SETS>
</MESSAGE>`;
}
