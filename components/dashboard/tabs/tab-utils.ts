import {
  DashboardTab,
  DashboardTabsData,
  DashboardLayoutItem,
  DashboardComponentConfig,
} from '@/types/dashboard';

// Tab Constants
export const TAB_TITLE_MAX_LENGTH = 50;
export const TAB_DEFAULT_TITLE_PREFIX = 'Untitled Tab';

/**
 * Generates a unique tab ID using timestamp and random string
 */
export function generateTabId(): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 11);
  return `tab-${timestamp}-${randomStr}`;
}

/**
 * Creates a new empty tab with the given tab number
 * @param tabNumber - The number to append to the tab title (1, 2, 3, etc.)
 */
export function createNewTab(tabNumber: number): DashboardTab {
  return {
    id: generateTabId(),
    title: `${TAB_DEFAULT_TITLE_PREFIX} ${tabNumber}`,
    layout_config: [],
    components: {},
  };
}

/**
 * Returns the default tabs configuration for new dashboards
 * Creates a single "Untitled Tab 1" tab
 */
export function getDefaultTabsConfig(): DashboardTabsData {
  const firstTab = createNewTab(1);
  return {
    tabs: [firstTab],
    activeTabId: firstTab.id,
  };
}

/**
 * Calculates the next tab number based on existing tabs
 * Finds the highest existing number and adds 1
 */
export function getNextTabNumber(tabs: DashboardTab[]): number {
  if (tabs.length === 0) return 1;

  // Extract numbers from existing tab titles
  const numbers = tabs.map((tab) => {
    const match = tab.title.match(/Untitled Tab (\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  });

  return Math.max(...numbers, tabs.length) + 1;
}

/**
 * Converts backend tabs array to frontend DashboardTabsData structure
 * Backend returns tabs as array, frontend needs {tabs, activeTabId}
 * @param tabs - Array of tabs from backend or undefined
 * @returns DashboardTabsData with activeTabId set to first tab
 */
export function initializeTabsData(tabs: DashboardTab[] | undefined | null): DashboardTabsData {
  if (tabs && Array.isArray(tabs) && tabs.length > 0) {
    return {
      tabs: tabs,
      activeTabId: tabs[0].id,
    };
  }
  return getDefaultTabsConfig();
}

/**
 * Gets the active tab's layout and components data
 * @param tabsData - The tabs data structure
 * @param activeTabId - Optional override for active tab ID
 * @returns Object with layout and components from active tab
 */
export function getActiveTabData(
  tabsData: DashboardTabsData | null,
  activeTabId?: string | null
): { layout: DashboardLayoutItem[]; components: Record<string, DashboardComponentConfig> } {
  if (!tabsData || !tabsData.tabs.length) {
    return { layout: [], components: {} };
  }

  const effectiveActiveTabId = activeTabId || tabsData.activeTabId;
  const activeTab = tabsData.tabs.find((t) => t.id === effectiveActiveTabId) || tabsData.tabs[0];

  return {
    layout: activeTab?.layout_config || [],
    components: activeTab?.components || {},
  };
}
