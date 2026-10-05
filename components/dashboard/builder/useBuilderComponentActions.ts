import { useCallback, useRef, type MutableRefObject } from 'react';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  getActiveEditorTab,
  removeWidgetFromLayout,
  updateActiveEditorTab,
} from '@/components/dashboard/logic/editor-state';
import type { EditorSetState } from '@/components/dashboard/builder/useDashboardSave';
import type { DashboardComponentConfig } from '@/types/dashboard';

type ActiveLayout = Parameters<typeof removeWidgetFromLayout>[0];
type ActiveComponents = Parameters<typeof removeWidgetFromLayout>[1];

interface BuilderComponentActionsOptions {
  dashboardId: number | undefined;
  activeLayout: ActiveLayout;
  activeComponents: ActiveComponents;
  setState: EditorSetState;
  isDraggingRef: MutableRefObject<boolean>;
}

/** Remove / update a widget on the active tab, as stable callbacks so the memoized cells don't re-render. */
export function useBuilderComponentActions({
  dashboardId,
  activeLayout,
  activeComponents,
  setState,
  isDraggingRef,
}: BuilderComponentActionsOptions) {
  // Remove component. Anything below the removed widget slides up (gravity-up);
  // side neighbours stay where they are. One history entry.
  const removeComponent = (componentId: string) => {
    const removedComponent = activeComponents[componentId];
    const removedType = removedComponent?.type;

    const nextTab = removeWidgetFromLayout(activeLayout, activeComponents, componentId);

    setState((prev) => updateActiveEditorTab(prev, nextTab));
    trackEvent(ANALYTICS_EVENTS.DASHBOARD_ELEMENT_REMOVED, {
      dashboard_id: dashboardId,
      element_type: removedType,
    });
  };

  // Update component config
  const updateComponent = (componentId: string, newConfig: DashboardComponentConfig['config']) => {
    // Skip constraint-driven updates while the user is dragging to prevent layout jumps.
    // Content constraints (minWidth/minHeight) are stored in config and propagated to RGL
    // as minW/minH; changing them mid-drag causes items to reflow under the pointer.
    if (isDraggingRef.current && newConfig.contentConstraints !== undefined) return;

    setState((prev) => {
      const tab = getActiveEditorTab(prev);
      return updateActiveEditorTab(prev, {
        components: {
          ...tab.components,
          [componentId]: {
            ...tab.components[componentId],
            config: newConfig,
          },
        },
      });
    });
  };

  // Stable ref-stabilized callbacks for DashboardCell so React.memo can do its job.
  // Each wraps a mutable ref so the stable identity never goes stale.
  const removeComponentRef = useRef(removeComponent);
  removeComponentRef.current = removeComponent;
  const stableRemoveComponent = useCallback((id: string) => removeComponentRef.current(id), []);

  const updateComponentRef = useRef(updateComponent);
  updateComponentRef.current = updateComponent;
  const stableUpdateComponent = useCallback(
    (id: string, config: DashboardComponentConfig['config']) =>
      updateComponentRef.current(id, config),
    []
  );

  return { stableRemoveComponent, stableUpdateComponent };
}
