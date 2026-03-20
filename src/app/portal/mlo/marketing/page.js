// Marketing Playbook — Admin-Only Portal Page
// Server component: reads markdown file and checks auth server-side.
// Only accessible to MLO users with role === 'admin'.

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { readFileSync } from 'fs';
import { join } from 'path';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import MarkdownContent from '@/components/Portal/MarkdownContent';

export const metadata = {
  title: 'Marketing Playbook | NetRate Mortgage Portal',
  robots: 'noindex, nofollow',
};

export default async function MarketingPlaybookPage() {
  // Auth check — must be authenticated MLO with admin role
  const session = await getServerSession(authOptions);

  if (!session || session.user.userType !== 'mlo') {
    redirect('/portal/mlo/login');
  }

  if (session.user.role !== 'admin') {
    redirect('/portal/mlo');
  }

  // Read the markdown file at request time
  const filePath = join(process.cwd(), 'src', 'data', 'marketing-playbook.md');
  const content = readFileSync(filePath, 'utf-8');

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/portal/mlo"
            className="text-sm text-gray-400 hover:text-brand transition-colors"
          >
            &larr; Back to Pipeline
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Marketing Playbook
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Strategy, channels, and implementation notes.
          </p>
        </div>
      </div>

      {/* Playbook Content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8">
        <MarkdownContent content={content} />
      </div>
    </div>
  );
}
