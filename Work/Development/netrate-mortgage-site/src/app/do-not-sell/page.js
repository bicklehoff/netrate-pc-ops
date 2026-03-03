export const metadata = {
  title: 'Do Not Sell My Personal Information | NetRate Mortgage',
  description: 'California Consumer Privacy Act (CCPA) notice and rights for NetRate Mortgage.',
};

export default function DoNotSellPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Do Not Sell My Personal Information</h1>
      <p className="text-sm text-gray-500 mb-8">Privacy Policy Notice &mdash; California</p>

      <div className="prose prose-sm prose-gray max-w-none space-y-6 text-gray-600 leading-relaxed">
        <h2 className="text-lg font-semibold text-gray-900">Exercise Your California Consumer Rights</h2>
        <p>
          This supplemental privacy notice is for California residents and is intended to apply solely to
          visitors, users, and persons who are residents in the State of California (&ldquo;consumers&rdquo;
          or &ldquo;you&rdquo;).
        </p>
        <p>
          This notice is an addendum to the information contained in our existing{' '}
          <a href="/privacy" className="text-brand hover:text-brand-dark">Privacy Policy</a> and its
          affiliates. We adopt this notice to comply with the California Consumer Privacy Act of 2018
          (&ldquo;CCPA&rdquo;) and other California privacy laws.
        </p>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">Information We Collect</h2>
        <p>
          We collect information that identifies, relates to, describes, references, is capable of being
          associated with, or could reasonably be linked, directly or indirectly, with a particular consumer
          or device (&ldquo;personal information&rdquo;).
        </p>
        <p>
          We have collected the following categories of personal information from consumers within the
          last twelve (12) months:
        </p>

        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm"><strong className="text-gray-900">Category: Identifiers</strong></p>
            <p className="text-sm mt-1">
              May include: a real name, alias, postal address, unique personal identifier, online identifier,
              Internet Protocol address, email address, or other similar identifiers.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm"><strong className="text-gray-900">Category: Personal Information</strong></p>
            <p className="text-sm mt-1">
              May include: a name, signature, address, telephone number, education level, employment status,
              driver license status, birthdate, medical or health information. Some personal information
              included in this category may overlap with other categories.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm"><strong className="text-gray-900">Category: Commercial Information</strong></p>
            <p className="text-sm mt-1">
              Records of personal property owned and/or products or services purchased or considered
              for purchase.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm"><strong className="text-gray-900">Category: Protected Classification Characteristics</strong></p>
            <p className="text-sm mt-1">
              May include: age, race, color, ancestry, national origin, citizenship, religion or creed,
              marital status, medical condition, physical or mental disability, sex (including gender, gender
              identity, gender expression, pregnancy or childbirth and related medical conditions), sexual
              orientation, veteran or military status, genetic information (including familial genetic
              information).
            </p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">Your Rights</h2>
        <p>Under the CCPA, California consumers have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Request that a business disclose what personal information it collects, uses, and shares</li>
          <li>Request that a business delete personal information it has collected</li>
          <li>Opt out of the sale of personal information</li>
          <li>Not be discriminated against for exercising their privacy rights</li>
        </ul>

        <h2 className="text-lg font-semibold text-gray-900 mt-8">How to Exercise Your Rights</h2>
        <p>
          To exercise your rights under the CCPA, or if you have questions about this notice, please
          contact us:
        </p>
        <p>
          NetRate Mortgage LLC<br />
          357 South McCaslin Blvd., #200, Louisville, CO 80027<br />
          Phone: <a href="tel:303-444-5251" className="text-brand hover:text-brand-dark">303-444-5251</a><br />
          Email: <a href="mailto:david@netratemortgage.com" className="text-brand hover:text-brand-dark">david@netratemortgage.com</a>
        </p>
      </div>
    </div>
  );
}
