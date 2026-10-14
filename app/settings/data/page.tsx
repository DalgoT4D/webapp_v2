'use client';

import DataSettings from '@/components/settings/data/DataSettings';
import { DATA_SECTION_ROLES, RoleGuard } from '@/lib/rbac';

export default function SettingsDataPage() {
  return (
    <RoleGuard roles={DATA_SECTION_ROLES}>
      <DataSettings />
    </RoleGuard>
  );
}
