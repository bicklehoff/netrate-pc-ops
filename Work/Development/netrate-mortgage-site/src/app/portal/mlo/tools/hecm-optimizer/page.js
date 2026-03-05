'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import HecmOptimizerPage from '@/components/Portal/HecmOptimizer/HecmOptimizerPage';

export default function HecmOptimizerRoute() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/portal/mlo/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (status !== 'authenticated') return null;

  return <HecmOptimizerPage />;
}
