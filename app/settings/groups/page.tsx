import UserGroups from '@/components/settings/groups/UserGroups';
import { DATA_SECTION_ROLES, RoleGuard } from '@/lib/rbac';

export default function GroupsPage() {
  return (
    <RoleGuard roles={DATA_SECTION_ROLES}>
      <UserGroups />
    </RoleGuard>
  );
}
