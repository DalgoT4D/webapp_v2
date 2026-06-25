import UserManagement from '@/components/settings/user-management/UserManagement';
import { ADMIN_ROLES, RoleGuard } from '@/lib/rbac';

export default function UserManagementPage() {
  return (
    <RoleGuard roles={ADMIN_ROLES}>
      <UserManagement />
    </RoleGuard>
  );
}
