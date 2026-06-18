'use client';

import { PipelineList } from '@/components/pipeline/orchestrate/pipeline-list';
import { DataSectionGuard } from '@/components/data-section-guard';

export default function OrchestratePage() {
  return (
    <DataSectionGuard>
      <PipelineList />
    </DataSectionGuard>
  );
}
