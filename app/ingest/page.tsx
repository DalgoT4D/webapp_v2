'use client';

import { Suspense } from 'react';
import { useIngestUiMode } from '@/hooks/useIngestUiMode';
import { ClassicIngestView } from '@/components/ingest/classic-ingest-view';
import { IngestView } from '@/components/ingest/redesign/ingest-view';
import { DATA_SECTION_ROLES, RoleGuard } from '@/lib/rbac';

function IngestPageContent() {
  const { mode, setMode } = useIngestUiMode();

  if (mode === 'classic') {
    return <ClassicIngestView mode={mode} onModeChange={setMode} />;
  }

  return <IngestView mode={mode} onModeChange={setMode} />;
}

export default function IngestPage() {
  return (
    <RoleGuard roles={DATA_SECTION_ROLES}>
      <Suspense fallback={<div className="p-6">Loading...</div>}>
        <IngestPageContent />
      </Suspense>
    </RoleGuard>
  );
}
