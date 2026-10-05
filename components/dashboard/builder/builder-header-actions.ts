import type { useRouter } from 'next/navigation';
import type { useCharts } from '@/hooks/api/useChart';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, DASHBOARD_UPDATE_SOURCES } from '@/constants/analytics';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import type { useDashboardSave } from '@/components/dashboard/builder/useDashboardSave';

interface BuilderHeaderActionsInput {
  dashboardId: number | undefined;
  title: string;
  setTitle: (title: string) => void;
  setIsEditingTitle: (isEditing: boolean) => void;
  saveDashboard: ReturnType<typeof useDashboardSave>['saveDashboard'];
  chartsData: ReturnType<typeof useCharts>['data'];
  chartsLoading: boolean;
  router: ReturnType<typeof useRouter>;
  setShowChartSelector: (open: boolean) => void;
}

/** Header handlers that need builder state: title commit, Add Chart, explicit Save. Rebuilt every render, as before. */
export function buildBuilderHeaderActions({
  dashboardId,
  title,
  setTitle,
  setIsEditingTitle,
  saveDashboard,
  chartsData,
  chartsLoading,
  router,
  setShowChartSelector,
}: BuilderHeaderActionsInput) {
  // Title edit ends (Enter or blur): blank → "Untitled Dashboard", then save.
  const handleTitleCommit = () => {
    const finalTitle = title.trim() || 'Untitled Dashboard';
    setTitle(finalTitle);
    setIsEditingTitle(false);
    saveDashboard();
  };

  // PINNED-BUGS: ""No charts → go create one" redirect can never fire — builder expects plain array, API returns paginated object"
  const handleAddChartClick = () => {
    if (!chartsLoading && chartsData && Array.isArray(chartsData) && chartsData.length === 0) {
      router.push('/charts/new?from=dashboard');
    } else {
      setShowChartSelector(true);
    }
  };

  const handleSaveClick = async () => {
    // Fire only on explicit user save (not the autosave/title-blur/resize
    // paths), and only once the PUT has actually succeeded — saveDashboard
    // handles its own errors, so firing before the await counted failed
    // saves as updates. The Save-and-View path fires the same event from
    // the edit page with source: SAVE_AND_VIEW.
    const saved = await saveDashboard();
    if (saved) {
      trackEvent(ANALYTICS_EVENTS.DASHBOARD_UPDATED, {
        dashboard_id: dashboardId,
        source: DASHBOARD_UPDATE_SOURCES.SAVE_BUTTON,
      });
    }
    const walkthrough = useInsightWalkthroughStore.getState();
    if (
      walkthrough.active &&
      (walkthrough.stage === 'builder_save' || walkthrough.stage === 'builder_resize')
    ) {
      walkthrough.advanceTo('builder_preview');
    }
  };

  return { handleTitleCommit, handleAddChartClick, handleSaveClick };
}
