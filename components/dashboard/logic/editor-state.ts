import {
  DashboardComponentType,
  type DashboardComponentConfig,
  type DashboardLayoutItem,
  type DashboardTab,
} from '@/types/dashboard';
import {
  calculateTextDimensions,
  getChartTypeFromConfig,
  getMinGridDimensions,
} from '@/lib/chart-size-constraints';
import { compactVertical } from '@/lib/dashboard-animation-utils';
import { initializeTabsData } from '@/components/dashboard/tabs/tab-utils';
import {
  GRID_COLUMN_COUNT,
  SCREEN_SIZES,
  type ScreenSizeKey,
} from '@/components/dashboard/grid/grid-constants';
import type { UnifiedTextConfig } from '@/components/dashboard/rich-text-config';
import type { RichTextFlushEventDetail } from '@/components/dashboard/text-element-unified';

/** The builder's undoable state: every tab, and which one is open. */
export interface DashboardEditorState {
  tabs: DashboardTab[];
  activeTabId: string;
}

/** Shape of the builder's setState (useUndoRedo's setter): value or updater function. */
export type EditorSetState = (
  next: DashboardEditorState | ((prev: DashboardEditorState) => DashboardEditorState)
) => void;

/** What the builder reads from the loaded dashboard on its first render. */
export interface BuilderInitialData {
  tabs?: DashboardTab[];
  layout_config?: DashboardLayoutItem[];
  components?: Record<string, DashboardComponentConfig>;
}

export interface DashboardSavePayloadOverrides {
  filter_layout?: 'vertical' | 'horizontal';
}

export interface DashboardSavePayloadInput {
  title: string;
  description: string;
  targetScreenSize: ScreenSizeKey;
  filterLayout: 'vertical' | 'horizontal';
  tabs: DashboardTab[];
  overrides?: DashboardSavePayloadOverrides;
}

type WidgetMap = Record<string, DashboardComponentConfig>;

export function getActiveEditorTab(state: DashboardEditorState): DashboardTab {
  return state.tabs.find((tab) => tab.id === state.activeTabId) || state.tabs[0];
}

export function updateActiveEditorTab(
  state: DashboardEditorState,
  update: Partial<Pick<DashboardTab, 'layout_config' | 'components'>>
): DashboardEditorState {
  return {
    ...state,
    tabs: state.tabs.map((tab) => (tab.id === state.activeTabId ? { ...tab, ...update } : tab)),
  };
}

/** Fills in missing content constraints on text widgets (logs each one it adds, as before). */
export function ensureTextContentConstraints(components: WidgetMap): WidgetMap {
  const updatedComponents = { ...components };
  Object.keys(updatedComponents).forEach((componentId) => {
    const component = updatedComponents[componentId];
    if (component.type === DashboardComponentType.TEXT && component.config) {
      const config = component.config as Partial<UnifiedTextConfig>;
      // Calculate content constraints if they don't exist (for both empty and filled content)
      if (!config.contentConstraints) {
        const textDimensions = calculateTextDimensions({
          content: config.content || '', // Handle empty content
          fontSize: config.fontSize || 16,
          fontWeight: config.fontWeight || 'normal',
          type: config.type || 'paragraph',
          textAlign: config.textAlign || 'left',
        });

        updatedComponents[componentId] = {
          ...component,
          config: {
            ...component.config,
            contentConstraints: {
              minWidth: textDimensions.width,
              minHeight: textDimensions.height,
            },
          },
        };

        console.log(`📐 Added missing content constraints for text component ${componentId}:`, {
          content: config.content,
          constraints: {
            minWidth: textDimensions.width,
            minHeight: textDimensions.height,
          },
        });
      }
    }
  });
  return updatedComponents;
}

/**
 * The tabs the builder starts from. Tabs are the single source of truth for the canvas, so
 * every tab (not only the visible one) gets text constraints and min-size-stamped items.
 */
export function normalizeEditorTabs(initialData: BuilderInitialData | undefined): DashboardTab[] {
  const rawInitialTabs = initializeTabsData(
    initialData?.tabs,
    Array.isArray(initialData?.layout_config) ? initialData.layout_config : [],
    initialData?.components || {}
  ).tabs;

  return rawInitialTabs.map((tab) => {
    const components = ensureTextContentConstraints(tab.components || {});
    const layout = (Array.isArray(tab.layout_config) ? tab.layout_config : []).map((item) => {
      const component = components[item.i];
      if (!component) return item;
      const chartType = getChartTypeFromConfig(component.config);
      const baseMinDimensions = getMinGridDimensions(chartType);
      return {
        ...item,
        w: item.w || baseMinDimensions.w,
        h: item.h || baseMinDimensions.h,
        minW: baseMinDimensions.w,
        minH: baseMinDimensions.h,
        maxW: GRID_COLUMN_COUNT,
      };
    });
    return { ...tab, layout_config: layout, components };
  });
}

/**
 * Reapplies per-widget min sizes to a layout RGL hands back. Positions are owned by RGL's grid
 * model; this only clamps w/h and stamps minW/minH/maxW so later drags/resizes enforce them
 * natively. Every widget (text included) uses its base type minimum — stored text
 * contentConstraints used to ratchet minW/minH up after the first resize and block shrinking.
 */
export function constrainLayoutItems(
  items: DashboardLayoutItem[],
  components: WidgetMap
): DashboardLayoutItem[] {
  return items.map((item) => {
    const component = components[item.i];
    if (!component) return item;
    const chartType = getChartTypeFromConfig(component.config);
    const minDimensions = getMinGridDimensions(chartType);
    return {
      ...item,
      w: Math.max(item.w, minDimensions.w),
      h: Math.max(item.h, minDimensions.h),
      minW: minDimensions.w,
      minH: minDimensions.h,
      maxW: GRID_COLUMN_COUNT,
    };
  });
}

/** The dashboard PUT body. Filters are not part of it — they have their own endpoints. */
export function buildDashboardSavePayload({
  title,
  description,
  targetScreenSize,
  filterLayout,
  tabs,
  overrides,
}: DashboardSavePayloadInput) {
  // Ensure title is not empty, use default if needed
  const finalTitle = title.trim() || 'Untitled Dashboard';

  // Create safe serializable payload (filters removed - managed independently)
  return {
    title: finalTitle,
    description,
    grid_columns: SCREEN_SIZES[targetScreenSize].cols,
    target_screen_size: targetScreenSize,
    filter_layout: filterLayout,
    tabs: JSON.parse(JSON.stringify(tabs)),
    // filters removed - managed via separate API endpoints
    ...overrides, // Apply any overrides passed to the function
  };
}

/** Writes flushed rich-text configs into whichever tab holds each widget. */
export function applyRichTextUpdates(
  state: DashboardEditorState,
  updates: RichTextFlushEventDetail['updates']
): DashboardEditorState {
  return updates.reduce<DashboardEditorState>(
    (currentState, update) => ({
      ...currentState,
      tabs: currentState.tabs.map((tab) =>
        tab.components[update.componentId]
          ? {
              ...tab,
              components: {
                ...tab.components,
                [update.componentId]: {
                  ...tab.components[update.componentId],
                  config: update.config as unknown as Record<string, unknown>,
                },
              },
            }
          : tab
      ),
    }),
    state
  );
}

/** Chart ids already on the tab — the picker marks them "Already added". */
export function getPlacedChartIds(components: WidgetMap | undefined): number[] {
  const chartIds: number[] = [];

  if (components) {
    Object.values(components).forEach((component) => {
      const chartId = component.config.chartId;
      if (component.type === DashboardComponentType.CHART && typeof chartId === 'number') {
        chartIds.push(chartId);
      }
    });
  }

  return chartIds;
}

/** KPI ids already on the tab — the picker marks them "Already added". */
export function getPlacedKpiIds(components: WidgetMap | undefined): number[] {
  const kpiIds: number[] = [];
  if (components) {
    Object.values(components).forEach((component) => {
      const kpiId = component.config.kpiId;
      if (component.type === DashboardComponentType.KPI && typeof kpiId === 'number') {
        kpiIds.push(kpiId);
      }
    });
  }
  return kpiIds;
}

/** The tab without one widget. Anything below it slides up (gravity-up); side neighbours stay. */
export function removeWidgetFromLayout(
  layout: DashboardLayoutItem[],
  components: WidgetMap,
  componentId: string
): Pick<DashboardTab, 'layout_config' | 'components'> {
  const newComponents = { ...components };
  delete newComponents[componentId];

  const newLayout = compactVertical(
    layout.filter((item) => item.i !== componentId),
    GRID_COLUMN_COUNT
  );
  return { layout_config: newLayout, components: newComponents };
}

export function addTab(prev: DashboardEditorState, newTab: DashboardTab): DashboardEditorState {
  return {
    tabs: [...prev.tabs, newTab],
    activeTabId: newTab.id,
  };
}

/**
 * Removes a tab. The last tab can't be removed and an unknown id does nothing — both return
 * `prev` itself, which is how callers tell a real removal from a no-op. When the active tab
 * goes, the one before it becomes active.
 */
export function removeTab(prev: DashboardEditorState, tabId: string): DashboardEditorState {
  if (prev.tabs.length <= 1) return prev;
  const tabIndex = prev.tabs.findIndex((tab) => tab.id === tabId);
  if (tabIndex < 0) return prev;
  const tabs = prev.tabs.filter((tab) => tab.id !== tabId);
  const activeTabId =
    prev.activeTabId === tabId
      ? tabs[Math.max(0, tabIndex - 1)]?.id || tabs[0].id
      : prev.activeTabId;
  return { tabs, activeTabId };
}

export function renameTab(
  prev: DashboardEditorState,
  tabId: string,
  newTitle: string
): DashboardEditorState {
  return {
    ...prev,
    tabs: prev.tabs.map((tab) => (tab.id === tabId ? { ...tab, title: newTitle } : tab)),
  };
}

/** Moves a tab to `toIndex` (clamped to the ends). Unknown id → `prev`. */
export function moveTab(
  prev: DashboardEditorState,
  tabId: string,
  toIndex: number
): DashboardEditorState {
  const nextFromIndex = prev.tabs.findIndex((tab) => tab.id === tabId);
  if (nextFromIndex < 0) return prev;
  const nextDestinationIndex = Math.max(0, Math.min(prev.tabs.length - 1, toIndex));
  const tabs = [...prev.tabs];
  const [movedTab] = tabs.splice(nextFromIndex, 1);
  tabs.splice(nextDestinationIndex, 0, movedTab);
  return { ...prev, tabs };
}
