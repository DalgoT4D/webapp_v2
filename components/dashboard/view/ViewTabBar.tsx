'use client';

import { TabBar } from '@/components/dashboard/tabs/TabBar';
import type { DashboardTabsData } from '@/types/dashboard';

interface ViewTabBarProps {
  tabs: DashboardTabsData['tabs'];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
}

/** The read-only tab bar of the view (sticky above the canvas, or inside the scroll area in report mode). */
export function ViewTabBar({ tabs, activeTabId, onTabChange }: ViewTabBarProps) {
  return (
    <TabBar
      tabs={tabs}
      activeTabId={activeTabId}
      isEditMode={false}
      onTabChange={onTabChange}
      onTabAdd={() => {}} // No-op in view mode
      onTabRemove={() => {}} // No-op in view mode
      onTabRename={() => {}} // No-op in view mode
    />
  );
}
