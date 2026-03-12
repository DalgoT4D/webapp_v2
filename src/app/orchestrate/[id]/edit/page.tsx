'use client';

import { use } from 'react';
import { PipelineForm } from '@/components/pipeline/pipeline-form';

interface EditPipelinePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EditPipelinePage({ params }: EditPipelinePageProps) {
  const { id } = use(params);

  return (
    <div className="p-6">
      <PipelineForm deploymentId={id} />
    </div>
  );
}
