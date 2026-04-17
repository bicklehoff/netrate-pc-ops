export const metadata = {
  title: 'Accessibility Statement | NetRate Mortgage',
  description: 'Accessibility commitment and statement for the NetRate Mortgage website.',
  alternates: { canonical: 'https://www.netratemortgage.com/accessibility' },
};

export default function AccessibilityPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Accessibility Statement</h1>

      <div className="prose prose-sm prose-gray max-w-none space-y-6 text-gray-600 leading-relaxed">
        <p>
          We are committed to providing an optimal user experience for everyone. To this end, we have
          committed to achieving and maintaining full accessibility for all of our online properties and
          services. Our goal is for this website and our services to be accessible for people with
          disabilities wherever possible.
        </p>

        <p>We have taken the following measures to support accessibility across our digital assets:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Include accessibility as an objective for our Design, UX, Marketing, Development, and Legal teams</li>
          <li>Use semantic HTML and ARIA attributes where appropriate</li>
          <li>Ensure adequate color contrast ratios throughout the site</li>
          <li>Support keyboard navigation for all interactive elements</li>
        </ul>

        <p>
          Please be aware that our process of testing and remediation is ongoing. We test with multiple
          device combinations and a variety of assistive technologies. We strive to achieve the highest
          level of accessibility in all areas but understand that due to the ever-changing landscape of
          the Web and the variety of assistive technologies available, occasional issues may arise for a
          particular user.
        </p>

        <p>
          Should this happen to you, please contact us at{' '}
          <a href="tel:303-444-5251" className="text-brand hover:text-brand-dark">303-444-5251</a>{' '}
          or{' '}
          <a href="mailto:david@netratemortgage.com" className="text-brand hover:text-brand-dark">
            david@netratemortgage.com
          </a>.
          Please specify the location and nature of the issue and we will respond in a timely manner
          and provide assistance.
        </p>

        <p>
          If our website provides links to companies and services outside of our organization, we encourage
          these sites to be compliant with accessibility requirements but we have no control over these
          sites and cannot assure their accessibility.
        </p>

        <p>
          We are committed to making the information and services on our public websites accessible to all
          users. We strive to make our sites accessible by people with disabilities and offer assistance
          when needed.
        </p>
      </div>
    </div>
  );
}
