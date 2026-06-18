import { RoleGuard } from './role-guard';

const DATA_SECTION_ROLES = ['admin', 'analyst'];

export function DataSectionGuard({ children }: { children: React.ReactNode }) {
  return <RoleGuard allowedRoles={DATA_SECTION_ROLES}>{children}</RoleGuard>;
}
