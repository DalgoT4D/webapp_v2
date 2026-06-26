'use client';

import { PipelineList } from '@/components/pipeline/orchestrate/pipeline-list';
import { DATA_SECTION_ROLES, RoleGuard } from '@/lib/rbac';

export default function OrchestratePage() {
  return (
    <RoleGuard roles={DATA_SECTION_ROLES}>
      <PipelineList />
    </RoleGuard>
  );
}
