'use client';

import { MetricLibraryList } from '@/components/metrics-library/MetricLibraryList';

/**
 * Metrics library — the reusable-primitive layer.
 *
 * canEdit is hardcoded `true` in this prototype; the dedicated Access
 * Controls spec will replace it with real role gating.
 */
export default function MetricsLibraryPage() {
  const canEdit = true;

  return (
    <div className="h-full overflow-y-auto">
      <MetricLibraryList canEdit={canEdit} />
    </div>
  );
}
