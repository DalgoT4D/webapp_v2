'use client';

import { useAuthStore } from '@/stores/authStore';
import { NoAccess } from './no-access';

const DATA_SECTION_ROLES = ['admin', 'analyst'];

export function DataSectionGuard({ children }: { children: React.ReactNode }) {
  const { getCurrentOrgUser } = useAuthStore();
  const roleSlug = getCurrentOrgUser()?.new_role_slug ?? '';

  if (roleSlug && !DATA_SECTION_ROLES.includes(roleSlug)) {
    return <NoAccess />;
  }

  return <>{children}</>;
}
