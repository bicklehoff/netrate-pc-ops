export const metadata = {
  title: 'Licensing | NetRate Mortgage',
  description: 'State licensing information for NetRate Mortgage LLC. NMLS #1111861.',
};

export default function LicensingPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Licensing</h1>

      <div className="prose prose-sm prose-gray max-w-none space-y-6 text-gray-600 leading-relaxed">
        <h2 className="text-lg font-semibold text-gray-900">State Licenses</h2>
        <ul className="list-none pl-0 space-y-2">
          <li><strong>Colorado</strong> &mdash; Mortgage Company Registration</li>
          <li><strong>Oregon</strong> &mdash; Mortgage Lending License #1111861</li>
          <li><strong>Texas</strong> &mdash; Savings and Mortgage Lending #1111861</li>
        </ul>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mt-6">
          <p className="text-sm text-gray-600">
            <strong className="text-gray-900">Mailing / Registered Address:</strong><br />
            357 South McCaslin Blvd., #200, Louisville, CO 80027
          </p>
          <p className="text-sm text-gray-600 mt-3">
            <strong className="text-gray-900">Company NMLS:</strong>{' '}
            <a
              href="https://nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/1111861"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:text-brand-dark"
            >
              #1111861
            </a>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            <strong className="text-gray-900">Individual NMLS (David Burson):</strong>{' '}
            <a
              href="https://nmlsconsumeraccess.org/EntityDetails.aspx/INDIVIDUAL/641790"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:text-brand-dark"
            >
              #641790
            </a>
          </p>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">Equal Housing Opportunity</h2>
        <p>
          NetRate Mortgage LLC is an Equal Housing Opportunity company. In accordance
          with the Equal Housing Opportunity Act, NetRate Mortgage does not discriminate against any applicant
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
