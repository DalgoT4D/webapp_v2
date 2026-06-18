import Transform from '@/components/transform/Transform';
import { DataSectionGuard } from '@/components/data-section-guard';

export default function TransformPage() {
  return (
    <DataSectionGuard>
      <Transform />
    </DataSectionGuard>
  );
}
