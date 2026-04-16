import {
  COMPANY_NAME,
  COMPANY_LEGAL_NAME,
  COMPANY_NMLS,
  INDIVIDUAL_NMLS,
  COMPANY_NMLS_URL,
  INDIVIDUAL_NMLS_URL,
  OFFICE_ADDRESS_LINE,
  PRINCIPAL_OFFICER,
  COMPANY_URL,
  STATE_LICENSES,
} from '@/lib/constants/company';

export const metadata = {
  title: `Licensing | ${COMPANY_NAME}`,
  description: `State licensing information for ${COMPANY_LEGAL_NAME}. NMLS #${COMPANY_NMLS}.`,
  alternates: { canonical: `${COMPANY_URL}/licensing` },
};

export default function LicensingPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Licensing</h1>

      <div className="prose prose-sm prose-gray max-w-none space-y-6 text-gray-600 leading-relaxed">
        <h2 className="text-lg font-semibold text-gray-900">State Licenses</h2>
        <ul className="list-none pl-0 space-y-2">
          <li><strong>California</strong> &mdash; DFPI {STATE_LICENSES.CA.licenseType} License #{STATE_LICENSES.CA.fileNumber} (California Financing Law)</li>
          <li><strong>Colorado</strong> &mdash; Mortgage Company Registration</li>
          <li><strong>Oregon</strong> &mdash; Mortgage Lending License #{STATE_LICENSES.OR.licenseNumber}</li>
          <li><strong>Texas</strong> &mdash; Savings and Mortgage Lending #{STATE_LICENSES.TX.licenseNumber}</li>
        </ul>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mt-6">
          <p className="text-sm text-gray-600">
            <strong className="text-gray-900">Mailing / Registered Address:</strong><br />
            {OFFICE_ADDRESS_LINE}
          </p>
          <p className="text-sm text-gray-600 mt-3">
            <strong className="text-gray-900">Company NMLS:</strong>{' '}
            <a
              href={COMPANY_NMLS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:text-brand-dark"
            >
              #{COMPANY_NMLS}
            </a>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            <strong className="text-gray-900">Individual NMLS ({PRINCIPAL_OFFICER.name}):</strong>{' '}
            <a
              href={INDIVIDUAL_NMLS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:text-brand-dark"
            >
              #{INDIVIDUAL_NMLS}
            </a>
          </p>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">State Disclosures</h2>

        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">California</h3>
            <p className="text-sm">
              {COMPANY_LEGAL_NAME} is licensed by the California {STATE_LICENSES.CA.agency} under the{' '}
              {STATE_LICENSES.CA.law}. {STATE_LICENSES.CA.licenseType} License #{STATE_LICENSES.CA.fileNumber}.
              Loans made or arranged pursuant to a California {STATE_LICENSES.CA.law} license. To file a
              complaint or for more information, visit{' '}
              <a href={STATE_LICENSES.CA.complaintUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-dark">dfpi.ca.gov</a>{' '}
              or call {STATE_LICENSES.CA.complaintPhone}.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Colorado</h3>
            <p className="text-sm">
              {COMPANY_LEGAL_NAME} is regulated by the Colorado Division of Real Estate, Department of
              Regulatory Agencies (DORA). To file a complaint or for more information, visit{' '}
              <a href="https://dora.colorado.gov/mortgage" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-dark">dora.colorado.gov/mortgage</a>{' '}
              or call 303-894-2166.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Oregon</h3>
            <p className="text-sm">
              {COMPANY_LEGAL_NAME} is licensed as a Mortgage Lender in Oregon (License #ML-{COMPANY_NMLS}) by the
              Oregon Division of Financial Regulation. {COMPANY_LEGAL_NAME} acts as a mortgage broker &mdash;
              loans are funded by third-party wholesale lenders, not by {COMPANY_LEGAL_NAME} directly.
              For more information, visit{' '}
              <a href="https://dfr.oregon.gov" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-dark">dfr.oregon.gov</a>{' '}
              or call 888-877-4894.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Texas</h3>
            <p className="text-sm">
              {COMPANY_LEGAL_NAME} is licensed by the Texas Department of Savings and Mortgage Lending
              (SML). CONSUMERS WISHING TO FILE A COMPLAINT AGAINST A COMPANY OR A RESIDENTIAL MORTGAGE
              LOAN ORIGINATOR SHOULD COMPLETE AND SEND A COMPLAINT FORM TO THE TEXAS DEPARTMENT OF SAVINGS
              AND MORTGAGE LENDING, 2601 NORTH LAMAR, SUITE 201, AUSTIN, TEXAS 78705. COMPLAINT FORMS AND
              INSTRUCTIONS MAY BE OBTAINED FROM THE DEPARTMENT&apos;S WEBSITE AT{' '}
              <a href="https://www.sml.texas.gov" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-dark">WWW.SML.TEXAS.GOV</a>.
              {' '}A TOLL-FREE CONSUMER HOTLINE IS AVAILABLE AT 1-877-276-5550. THE DEPARTMENT MAINTAINS A
              RECOVERY FUND TO MAKE PAYMENTS OF CERTAIN ACTUAL OUT OF POCKET DAMAGES SUSTAINED BY BORROWERS
              CAUSED BY ACTS OF LICENSED RESIDENTIAL MORTGAGE LOAN ORIGINATORS. A WRITTEN APPLICATION FOR
              REIMBURSEMENT FROM THE RECOVERY FUND MUST BE FILED WITH AND INVESTIGATED BY THE DEPARTMENT
              PRIOR TO THE PAYMENT OF A CLAIM. FOR MORE INFORMATION ABOUT THE RECOVERY FUND, PLEASE CONSULT
              THE DEPARTMENT&apos;S WEBSITE AT WWW.SML.TEXAS.GOV.
            </p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">Equal Housing Opportunity</h2>
        <p>
          {COMPANY_LEGAL_NAME} is an Equal Housing Opportunity company. In accordance
          with the Equal Housing Opportunity Act, {COMPANY_NAME} does not discriminate against any applicant
          on the basis of race, color, religion, creed, national origin, ancestry, sex, marital status,
          familial status (number and age of children), sexual orientation, age (provided that the applicant
          has the capacity to enter into a binding agreement), medical history, disability, physical condition,
          military status; because the applicant has in good faith exercised any right under the Consumer
          Credit Protection Act or the Service Members Civil Relief Act (SCRA); that all or part of a
          consumer&apos;s income derives from a public assistance program, or any other basis prohibited
          by law.
        </p>
      </div>
    </div>
  );
}
