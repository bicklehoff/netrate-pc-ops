// Application Gate — determines when a loan becomes an MCR application
// Based on Reg B / TRID: an application requires all 5 pieces of data:
// 1. Borrower name
// 2. SSN / credit pull (credit score as proxy)
// 3. Property address (with state)
// 4. Loan amount
// 5. Income

/**
 * Check if a loan has all 5 required fields to be considered an MCR application.
 * @param {object} loan - Loan record (with borrower relation or flat fields)
 * @param {object} borrower - Borrower record (optional, for SSN check)
 * @returns {boolean}
 */
export function checkApplicationGate(loan, borrower = null) {
  // 1. Borrower name — check loan's borrower relation or LoanBorrower
  const hasName = !!(
    (borrower?.firstName && borrower?.lastName) ||
    (loan.borrower?.firstName && loan.borrower?.lastName)
  );

  // 2. Credit pull — SSN on file or credit score recorded
  const hasCredit = !!(
    borrower?.ssnEncrypted ||
    loan.borrower?.ssnEncrypted ||
    loan.creditScore
  );

  // 3. Property address with state
  const addr = loan.propertyAddress;
  const hasProperty = !!(addr && addr.state && addr.street);

  // 4. Loan amount
  const hasAmount = !!(loan.loanAmount && Number(loan.loanAmount) > 0);

  // 5. Income
  const hasIncome = !!(loan.monthlyBaseIncome && Number(loan.monthlyBaseIncome) > 0);

  return hasName && hasCredit && hasProperty && hasAmount && hasIncome;
}

/**
 * Check the gate and return which fields are missing (for UI display).
 * @param {object} loan
 * @param {object} borrower
 * @returns {{ passed: boolean, missing: string[] }}
 */
export function applicationGateStatus(loan, borrower = null) {
  const missing = [];

  const hasName = !!(
    (borrower?.firstName && borrower?.lastName) ||
    (loan.borrower?.firstName && loan.borrower?.lastName)
  );
  if (!hasName) missing.push('borrowerName');

  const hasCredit = !!(
    borrower?.ssnEncrypted ||
    loan.borrower?.ssnEncrypted ||
    loan.creditScore
  );
  if (!hasCredit) missing.push('creditPull');

  const addr = loan.propertyAddress;
  if (!(addr && addr.state && addr.street)) missing.push('propertyAddress');

  if (!(loan.loanAmount && Number(loan.loanAmount) > 0)) missing.push('loanAmount');

  if (!(loan.monthlyBaseIncome && Number(loan.monthlyBaseIncome) > 0)) missing.push('income');

  return { passed: missing.length === 0, missing };
}
