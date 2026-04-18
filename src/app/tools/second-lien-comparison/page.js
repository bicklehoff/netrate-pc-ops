import SubFinancingComparison from '@/components/calculators/SubFinancingComparison';

export const metadata = {
  title: 'Tap Equity: 2nd Lien vs. Cash-Out Refi Calculator | NetRate Mortgage',
  description:
    'Need cash from your home equity? Compare opening a new 2nd lien vs. cash-out refinancing. See the real math on whether you can keep your low first mortgage rate.',
  alternates: { canonical: 'https://www.netratemortgage.com/tools/second-lien-comparison' },
};

export default function SecondLienComparisonPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <SubFinancingComparison />
    </div>
  );
}
