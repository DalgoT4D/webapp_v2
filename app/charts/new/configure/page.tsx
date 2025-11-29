'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChartBuilderPage } from '@/components/charts/ChartBuilderPage';

function ConfigureChartPageContent() {
  const searchParams = useSearchParams();

  // Get parameters from URL
  const schema = searchParams.get('schema') || '';
  const table = searchParams.get('table') || '';
  const chartType = searchParams.get('type') || 'bar';

  return (
    <ChartBuilderPage schema={schema} table={table} chartType={chartType} backUrl="/charts/new" />
  );
}

export default function ConfigureChartPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfigureChartPageContent />
    </Suspense>
  );
}
