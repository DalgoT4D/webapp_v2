import AccessPage from '@/components/settings/access/AccessPage';
import { ACCESS_PAGE_ROLES, RoleGuard } from '@/lib/rbac';

export default function Page() {
  return (
    <RoleGuard roles={ACCESS_PAGE_ROLES}>
      <AccessPage />
    </RoleGuard>
  );
}
