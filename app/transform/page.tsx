import Transform from '@/components/transform/Transform';
import { DATA_SECTION_ROLES, RoleGuard } from '@/lib/rbac';

export default function TransformPage() {
  return (
    <RoleGuard roles={DATA_SECTION_ROLES}>
      <Transform />
    </RoleGuard>
  );
}
