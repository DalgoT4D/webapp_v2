import type { DashboardLayoutItem, DashboardTabsData } from '@/types/dashboard';
import { compactVertical } from '@/lib/dashboard-animation-utils';

export interface CrossTabMove {
  componentId: string;
  sourceTabId: string;
  targetTabId: string;
  x: number;
  y: number;
}

export interface GridMetrics {
  containerWidth: number;
  containerLeft: number;
  containerTop: number;
  cols: number;
  rowHeight: number;
  marginX: number;
  marginY: number;
  paddingX: number;
  paddingY: number;
}

// Sentinel index for the dropped widget, which lives outside the `others` array.
const MOVED_ITEM_ANCHOR = -1;

function collides(a: DashboardLayoutItem, b: DashboardLayoutItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function pointerToGridPosition(
  clientX: number,
  clientY: number,
  item: Pick<DashboardLayoutItem, 'w' | 'h'>,
  metrics: GridMetrics
): { x: number; y: number } {
  const usableWidth =
    metrics.containerWidth - metrics.paddingX * 2 - metrics.marginX * (metrics.cols - 1);
  const columnWidth = usableWidth / metrics.cols;
  const columnStep = columnWidth + metrics.marginX;
  const rowStep = metrics.rowHeight + metrics.marginY;
  const rawX = Math.round((clientX - metrics.containerLeft - metrics.paddingX) / columnStep);
  // containerTop belongs to the grid container inside the scrolling canvas. Its
  // viewport position already changes with canvas scroll, so adding scrollTop
  // here would count the scroll offset twice.
  const rawY = Math.round((clientY - metrics.containerTop - metrics.paddingY) / rowStep);

  return {
    x: Math.max(0, Math.min(metrics.cols - item.w, rawX)),
    y: Math.max(0, rawY),
  };
}

/**
 * Places a moved item at the requested location and pushes colliding destination
 * items downward. The moved item keeps priority at the chosen coordinates.
 */
export function placeItemInLayout(
  layout: DashboardLayoutItem[],
  item: DashboardLayoutItem,
  cols: number
): DashboardLayoutItem[] {
  const placedItem = {
    ...item,
    x: Math.max(0, Math.min(cols - item.w, item.x)),
    y: Math.max(0, item.y),
  };
  const others = layout.map((entry) => ({ ...entry }));
  // Anchors are queued as indices into `others` (MOVED_ITEM_ANCHOR = the dropped item) so
  // every anchor is re-read at its *current* position. Queuing snapshots instead let a
  // stale anchor drag an already-pushed widget back up, so two widgets shoved each other
  // up and down forever and the drop froze the browser tab.
  const queue: number[] = [MOVED_ITEM_ANCHOR];

  while (queue.length > 0) {
    const anchorIndex = queue.shift()!;
    const anchor = anchorIndex === MOVED_ITEM_ANCHOR ? placedItem : others[anchorIndex];
    for (let index = 0; index < others.length; index += 1) {
      if (index === anchorIndex) continue;
      const candidate = others[index];
      if (candidate.i === anchor.i) continue;
      if (!collides(anchor, candidate)) continue;
      // Push down only — an upward move would re-collide and could cycle forever.
      const nextY = Math.max(candidate.y, anchor.y + anchor.h);
      if (nextY === candidate.y) continue;
      others[index] = { ...candidate, y: nextY };
      queue.push(index);
    }
  }

  return [...others, placedItem];
}

export function moveWidgetBetweenTabs(
  state: DashboardTabsData,
  move: CrossTabMove,
  cols: number
): DashboardTabsData {
  if (move.sourceTabId === move.targetTabId) return state;
  const source = state.tabs.find((tab) => tab.id === move.sourceTabId);
  const target = state.tabs.find((tab) => tab.id === move.targetTabId);
  const component = source?.components[move.componentId];
  const layoutItem = source?.layout_config.find((item) => item.i === move.componentId);

  if (!source || !target || !component || !layoutItem || target.components[move.componentId]) {
    return state;
  }

  const sourceLayout = compactVertical(
    source.layout_config.filter((item) => item.i !== move.componentId),
    cols
  );
  const targetLayout = placeItemInLayout(
    target.layout_config,
    { ...layoutItem, x: move.x, y: move.y },
    cols
  );
  const sourceComponents = { ...source.components };
  delete sourceComponents[move.componentId];

  return {
    tabs: state.tabs.map((tab) => {
      if (tab.id === source.id) {
        return { ...tab, layout_config: sourceLayout, components: sourceComponents };
      }
      if (tab.id === target.id) {
        return {
          ...tab,
          layout_config: targetLayout,
          components: { ...target.components, [move.componentId]: component },
        };
      }
      return tab;
    }),
    activeTabId: target.id,
  };
}
