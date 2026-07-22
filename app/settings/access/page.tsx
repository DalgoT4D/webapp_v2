import { Suspense } from 'react';
import AccessPage from '@/components/settings/access/AccessPage';
import { DATA_SECTION_ROLES, RoleGuard } from '@/lib/rbac';

// Settings → Access: People / Groups / Roles in one page. Analysts can enter
// (they need Groups); the People and Roles tabs are hidden for them inside
// AccessPage, mirroring the old standalone pages' ADMIN_ROLES guards.
export default function SettingsAccessPage() {
  return (
    <RoleGuard roles={DATA_SECTION_ROLES}>
      {/* Suspense boundary required by useSearchParams (?tab= deep links) */}
      <Suspense fallback={null}>
        <AccessPage />
      </Suspense>
    </RoleGuard>
  );
}
