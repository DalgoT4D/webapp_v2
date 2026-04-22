'use client';

import { KPIsList } from '@/components/kpis/KPIsList';

/**
 * KPIs page — tracked layer with target, RAG, trend, and annotation timeline.
 *
 * Permissions scaffolding: `canEdit` is hardcoded `true` in this prototype.
 * Real role gating lands with the separate Access Controls spec.
 */
export default function KPIsPage() {
  const canEdit = true;

  return (
    <div className="h-full overflow-y-auto">
      <KPIsList canEdit={canEdit} />
    </div>
  );
}
