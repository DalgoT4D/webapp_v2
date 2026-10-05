import { useCallback, useMemo, useState } from 'react';
import type { DashboardTabsData } from '@/types/dashboard';
import { initializeTabsData } from '@/components/dashboard/tabs/tab-utils';

/** View-mode tabs: which tab is open (local only) over the dashboard's saved tabs. */
export function useViewTabs(
  dashboard: { tabs?: Parameters<typeof initializeTabsData>[0] } | null | undefined
) {
  // Tabs state for view mode - only need to track active tab for switching
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Derive tabs data from dashboard
  const tabsData: DashboardTabsData | null = useMemo(() => {
    if (!dashboard) return null;
    return initializeTabsData(dashboard.tabs);
  }, [dashboard]);

  // Get effective active tab ID
  const effectiveActiveTabId =
    activeTabId || tabsData?.activeTabId || tabsData?.tabs?.[0]?.id || null;

  // Derive the current tab's layout/components to render
  const currentTab = useMemo(() => {
    if (tabsData && effectiveActiveTabId) {
      return tabsData.tabs.find((t) => t.id === effectiveActiveTabId) || null;
    }
    return null;
  }, [tabsData, effectiveActiveTabId]);

  // Handle tab change in view mode
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  // Check if we should show tabs (2 or more tabs)
  const shouldShowTabs = tabsData && (tabsData.tabs?.length ?? 0) >= 2;

  return { tabsData, effectiveActiveTabId, currentTab, handleTabChange, shouldShowTabs };
}
