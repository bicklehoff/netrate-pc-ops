import SubFinancingComparison from '@/components/calculators/SubFinancingComparison';

export const metadata = {
  title: 'Keep Your Second Lien or Pay It Off? | NetRate Mortgage',
  description: 'Compare the cost of keeping your HELOC or second mortgage vs. paying it off with a cash-out refinance. See the real pricing impact side by side.',
};

export default function SecondLienComparisonPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <SubFinancingComparison />
    </div>
  );
}
