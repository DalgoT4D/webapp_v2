'use client';

import { IngestView } from '@/components/ingest/redesign/ingest-view';
import { DATA_SECTION_ROLES, RoleGuard } from '@/lib/rbac';

export default function IngestPage() {
  return (
    <RoleGuard roles={DATA_SECTION_ROLES}>
      <IngestView />
    </RoleGuard>
  );
}
