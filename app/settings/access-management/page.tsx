import AccessManagement from '@/components/settings/access-management/AccessManagement';
import { ADMIN_ROLES, RoleGuard } from '@/lib/rbac';

export default function AccessManagementPage() {
  return (
    <RoleGuard roles={ADMIN_ROLES}>
      <AccessManagement />
    </RoleGuard>
  );
}
