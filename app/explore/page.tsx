import { Explore } from '@/components/explore';
import { DataSectionGuard } from '@/components/data-section-guard';

export default function ExplorePage() {
  return (
    <DataSectionGuard>
      <Explore />
    </DataSectionGuard>
  );
}
