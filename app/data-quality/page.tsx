import { DataQuality } from '@/components/data-quality/data-quality';
import { DATA_SECTION_ROLES, RoleGuard } from '@/lib/rbac';

export default function DataQualityPage() {
  return (
    <RoleGuard roles={DATA_SECTION_ROLES}>
      <DataQuality />
    </RoleGuard>
  );
}
