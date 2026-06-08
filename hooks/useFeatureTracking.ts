import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { featureForPathname } from '@/constants/analytics';
import { trackFeatureView } from '@/lib/analytics';

// Fires a feature:viewed breadth event whenever the user navigates to a mapped
// feature. Deduped per feature so re-renders on the same feature do not refire.
// Mounted once in client-layout.tsx. Tabs within a page are tracked separately
// by each page's tab onChange handler.
export function useFeatureTracking(): void {
  const pathname = usePathname();
  const lastFeature = useRef<string | null>(null);

  useEffect(() => {
    const feature = featureForPathname(pathname);
    if (feature && feature !== lastFeature.current) {
      trackFeatureView(feature);
      lastFeature.current = feature;
    }
  }, [pathname]);
}
