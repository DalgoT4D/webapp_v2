import { DashboardTab, DashboardTabsData } from '@/types/dashboard';

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
    order: tabNumber - 1,
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
