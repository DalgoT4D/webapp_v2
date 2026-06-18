import UserManagement from '@/components/settings/user-management/UserManagement';
import { RoleGuard } from '@/components/role-guard';

export default function UserManagementPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <UserManagement />
    </RoleGuard>
  );
}
