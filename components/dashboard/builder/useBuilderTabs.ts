'use client';

import { useCallback, type RefObject } from 'react';
import type { DashboardTab } from '@/types/dashboard';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  addTab,
  moveTab,
  removeTab,
  renameTab,
  type DashboardEditorState,
} from '@/components/dashboard/logic/editor-state';
import type { EditorSetState } from './useDashboardSave';

interface BuilderTabsOptions {
  dashboardId: number | undefined;
  stateRef: RefObject<DashboardEditorState>;
  setState: EditorSetState;
  setStateWithoutHistory: EditorSetState;
  flushActiveRichText: () => DashboardEditorState;
  setDragPreviewTabId: (tabId: string | null) => void;
}

/** Select / add / remove / rename / reorder tabs (the three lifecycle events fire here). */
export function useBuilderTabs({
  dashboardId,
  stateRef,
  setState,
  setStateWithoutHistory,
  flushActiveRichText,
  setDragPreviewTabId,
}: BuilderTabsOptions) {
  // ===== Tab Handlers =====

  // Tab selection is navigation, not an edit, so it does not add a history entry.
  const handleTabChange = useCallback(
    (tabId: string) => {
      if (!stateRef.current.tabs.some((tab) => tab.id === tabId)) return;
      flushActiveRichText();
      setDragPreviewTabId(null);
      setStateWithoutHistory((prev) => ({ ...prev, activeTabId: tabId }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unchanged dependency list
    [flushActiveRichText, setStateWithoutHistory]
  );

  // The three tab-lifecycle events fire from these handlers rather than from TabBar,
  // which has no dashboardId. Every add/remove/rename control in TabBar funnels through
  // here, so this is also the one place that can't be bypassed by a new button.
  const handleTabAdd = useCallback(
    (newTab: DashboardTab) => {
      setState((prev) => addTab(prev, newTab));
      trackEvent(ANALYTICS_EVENTS.DASHBOARD_TAB_CREATED, { dashboard_id: dashboardId });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unchanged dependency list
    [setState]
  );

  // Handle removing a tab
  const handleTabRemove = useCallback(
    (tabId: string) => {
      let removed = false;
      setState((prev) => {
        const next = removeTab(prev, tabId);
        if (next !== prev) removed = true;
        return next;
      });
      // Only on a real removal — the last tab can't be deleted, and an unknown id is a
      // no-op, so tracking before this guard would count deletions that never happened.
      if (removed) {
        trackEvent(ANALYTICS_EVENTS.DASHBOARD_TAB_DELETED, { dashboard_id: dashboardId });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unchanged dependency list
    [setState]
  );

  // Handle renaming a tab
  const handleTabRename = useCallback(
    (tabId: string, newTitle: string) => {
      setState((prev) => renameTab(prev, tabId, newTitle));
      trackEvent(ANALYTICS_EVENTS.DASHBOARD_TAB_RENAMED, { dashboard_id: dashboardId });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unchanged dependency list
    [setState]
  );

  const handleTabReorder = useCallback(
    (tabId: string, toIndex: number) => {
      const currentTabs = stateRef.current.tabs;
      const fromIndex = currentTabs.findIndex((tab) => tab.id === tabId);
      const destinationIndex = Math.max(0, Math.min(currentTabs.length - 1, toIndex));
      if (fromIndex < 0 || destinationIndex === fromIndex) return;

      setState((prev) => moveTab(prev, tabId, toIndex));
      trackEvent(ANALYTICS_EVENTS.DASHBOARD_TAB_REORDERED, {
        dashboard_id: dashboardId,
        from_index: fromIndex,
        to_index: destinationIndex,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unchanged dependency list
    [setState]
  );

  // ===== End Tab Handlers =====

  return { handleTabChange, handleTabAdd, handleTabRemove, handleTabRename, handleTabReorder };
}
