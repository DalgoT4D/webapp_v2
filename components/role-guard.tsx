'use client';

import { useAuthStore } from '@/stores/authStore';
import { NoAccess } from './no-access';

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { getCurrentOrgUser } = useAuthStore();
  const roleSlug = getCurrentOrgUser()?.new_role_slug ?? '';

  if (roleSlug && !allowedRoles.includes(roleSlug)) {
    return <NoAccess />;
  }

  return <>{children}</>;
}
