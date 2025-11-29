'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { ChartBuilderPage } from '@/components/charts/ChartBuilderPage';

function EditChartPageContent() {
  const params = useParams();
  const chartId = Number(params.id);

  return <ChartBuilderPage chartId={chartId} />;
}

export default function EditChartPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditChartPageContent />
    </Suspense>
  );
}
