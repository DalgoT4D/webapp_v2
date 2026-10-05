'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getChartViewUrl, parseWidgetNavigationSource } from '@/lib/widget-navigation';

/** Edit page navigation: origin-aware (dashboard/report) and marks the config saved before leaving. */
export function useEditChartNavigation({ markSaved }: { markSaved: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const navigationSource = parseWidgetNavigationSource(searchParams.get('from'));
  const hasNavigationSource = navigationSource !== null;

  const navigateWithoutWarning = useCallback(
    (url: string) => {
      markSaved(); // Mark as saved
      router.push(url);
    },
    [router, markSaved]
  );

  const navigateBackWithoutWarning = useCallback(() => {
    markSaved(); // Mark as saved
    router.back();
  }, [router, markSaved]);

  const navigateReplaceWithoutWarning = useCallback(
    (url: string) => {
      markSaved(); // Mark as saved
      router.replace(url);
    },
    [router, markSaved]
  );

  // Preserve dashboard/report context while moving between detail and edit.
  const chartDetailUrl = useCallback(
    (id: number | string) => {
      return getChartViewUrl(id, navigationSource);
    },
    [navigationSource]
  );

  // Replace for dashboard/report origins to keep the source as the previous history entry.
  const navigateToChartDetail = useCallback(
    (id: number | string) => {
      if (hasNavigationSource) {
        navigateReplaceWithoutWarning(chartDetailUrl(id));
      } else {
        navigateWithoutWarning(chartDetailUrl(id));
      }
    },
    [hasNavigationSource, navigateReplaceWithoutWarning, navigateWithoutWarning, chartDetailUrl]
  );

  // Navigate back to the originating dashboard/report after exit-save.
  const navigateToOrigin = useCallback(() => {
    if (hasNavigationSource) {
      navigateBackWithoutWarning();
    } else {
      navigateWithoutWarning('/charts');
    }
  }, [hasNavigationSource, navigateBackWithoutWarning, navigateWithoutWarning]);

  return {
    navigationSource,
    hasNavigationSource,
    chartDetailUrl,
    navigateWithoutWarning,
    navigateBackWithoutWarning,
    navigateToChartDetail,
    navigateToOrigin,
  };
}

export type EditChartNavigation = ReturnType<typeof useEditChartNavigation>;
