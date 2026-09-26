'use client';

import CopilotSettings from '@/components/settings/copilot/CopilotSettings';
import { ADMIN_ROLES, RoleGuard } from '@/lib/rbac';

export default function SettingsCopilotPage() {
  return (
    <RoleGuard roles={ADMIN_ROLES}>
      <CopilotSettings />
    </RoleGuard>
  );
}
