import { Explore } from '@/components/explore';
import { DATA_SECTION_ROLES, RoleGuard } from '@/lib/rbac';

export default function ExplorePage() {
  return (
    <RoleGuard roles={DATA_SECTION_ROLES}>
      <Explore />
    </RoleGuard>
  );
}
