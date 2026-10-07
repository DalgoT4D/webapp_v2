'use client';

import Branding from '@/components/settings/branding/Branding';
import { ADMIN_ROLES, RoleGuard } from '@/lib/rbac';

export default function SettingsBrandingPage() {
  return (
    <RoleGuard roles={ADMIN_ROLES}>
      <Branding />
    </RoleGuard>
  );
}
