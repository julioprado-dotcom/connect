'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { LoadingScreen } from '@/components/dashboard/LoadingScreen';

const NewDashboard = dynamic(
  () => import('@/components/dashboard/NewDashboard'),
  { ssr: false, loading: () => <LoadingScreen /> }
);

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <NewDashboard />
    </Suspense>
  );
}
