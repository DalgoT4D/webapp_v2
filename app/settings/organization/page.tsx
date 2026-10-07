'use client';

import OrganizationSettings from '@/components/settings/organization/OrganizationSettings';
import { ADMIN_ROLES, RoleGuard } from '@/lib/rbac';

export default function SettingsOrganizationPage() {
  return (
    <RoleGuard roles={ADMIN_ROLES}>
      <OrganizationSettings />
    </RoleGuard>
  );
}
