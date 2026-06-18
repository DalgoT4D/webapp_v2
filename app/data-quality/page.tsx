import { DataQuality } from '@/components/data-quality/data-quality';
import { DataSectionGuard } from '@/components/data-section-guard';

export default function DataQualityPage() {
  return (
    <DataSectionGuard>
      <DataQuality />
    </DataSectionGuard>
  );
}
