'use client';

import { MetricsList } from '@/components/metrics/MetricsList';

/**
 * My Metrics page — KPI tracking with RAG status.
 *
 * Permissions:
 *   - All roles can view metrics.
 *   - Analyst and above can add/edit metrics and annotations.
 *
 * The canEdit prop is derived from the user's role. For the prototype,
 * we default to true (editable). In production, wire this to the
 * role-based permission check from useAuthStore / request.permissions.
 */
export default function MetricsPage() {
  // TODO: wire to real permission check, e.g.:
  // const canEdit = userRole !== 'guest';
  const canEdit = true;

  return <MetricsList canEdit={canEdit} />;
}
