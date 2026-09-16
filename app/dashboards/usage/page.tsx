'use client';

import UsageDashboard from '@/components/dashboards/usage-dashboard';
import { ACCESS_PAGE_ROLES, RoleGuard } from '@/lib/rbac';

export default function UsageDashboardPage() {
  return (
    <RoleGuard roles={ACCESS_PAGE_ROLES}>
      <UsageDashboard />
    </RoleGuard>
  );
}
