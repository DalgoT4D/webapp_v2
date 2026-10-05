import { act, renderHook } from '@testing-library/react';
import { DashboardComponentType, type DashboardLayoutItem } from '@/types/dashboard';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import type { DashboardEditorState } from '@/components/dashboard/logic/editor-state';
import {
  CROSS_TAB_HOVER_DELAY_MS,
  useCrossTabDrag,
} from '@/components/dashboard/hooks/useCrossTabDrag';

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

const item: DashboardLayoutItem = { i: 'chart-1', x: 0, y: 0, w: 6, h: 4 };
const editorState: DashboardEditorState = {
  activeTabId: 'src',
  tabs: [
    {
      id: 'src',
      title: 'Source',
      layout_config: [item],
      components: {
        'chart-1': { id: 'chart-1', type: DashboardComponentType.CHART, config: { chartId: 1 } },
      },
    },
    { id: 'dst', title: 'Target', layout_config: [], components: {} },
  ],
};

const rect = (r: Partial<DOMRect>) => () =>
  ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, ...r }) as DOMRect;
const mouse = (clientX: number, clientY: number) => ({ clientX, clientY }) as MouseEvent;

function setup() {
  const setState = jest.fn();
  const onGridDragStop = jest.fn();
  const setDragPreviewTabId = jest.fn();
  const canvas = document.createElement('div');
  canvas.getBoundingClientRect = rect({ left: 0, top: 0, right: 1304, bottom: 800 });
  const container = document.createElement('div');
  container.getBoundingClientRect = rect({ left: 0, top: 0, width: 1304 });
  const tabEl = document.createElement('div');
  tabEl.dataset.dashboardTabId = 'dst';
  document.elementsFromPoint = jest.fn(() => [tabEl]);
  const hook = renderHook(() =>
    useCrossTabDrag({
      dashboardId: 7,
      stateRef: { current: editorState },
      setState,
      canvasRef: { current: canvas },
      dashboardContainerRef: { current: container },
      cols: 12,
      actualContainerWidth: 1304,
      setDragPreviewTabId,
      onGridDragStop,
    })
  );
  return { setState, onGridDragStop, setDragPreviewTabId, ...hook };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

describe('useCrossTabDrag', () => {
  it('drag start opens a grid session and announces the drag to text widgets', () => {
    const { result } = setup();
    const heard = jest.fn();
    document.addEventListener('dashboard:widget-drag-start', heard);
    act(() => result.current.handleDragStart([item], item, item, item, mouse(10, 10)));
    expect(result.current.crossTabDrag).toMatchObject({
      componentId: 'chart-1',
      componentType: 'chart',
      sourceTabId: 'src',
      phase: 'grid',
    });
    expect(result.current.isDraggingRef.current).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);
    document.removeEventListener('dashboard:widget-drag-start', heard);
  });

  it('a normal drop on the grid ends the session and commits through onGridDragStop', () => {
    const { result, onGridDragStop } = setup();
    document.elementsFromPoint = jest.fn((): Element[] => []);
    act(() => result.current.handleDragStart([item], item, item, item, mouse(10, 10)));
    const moved = [{ ...item, y: 3 }];
    act(() => result.current.handleDragStop(moved));
    expect(onGridDragStop).toHaveBeenCalledWith(moved, false);
    expect(result.current.crossTabDrag).toBeNull();
    expect(result.current.isDraggingRef.current).toBe(false);
  });

  it('releasing over a tab before the dwell cancels (releasedOverTab = true)', () => {
    const { result, onGridDragStop } = setup();
    act(() => result.current.handleDragStart([item], item, item, item, mouse(10, 10)));
    act(() => result.current.handleDrag([item], item, item, item, mouse(50, 5)));
    act(() => jest.advanceTimersByTime(CROSS_TAB_HOVER_DELAY_MS - 1));
    act(() => result.current.handleDragStop([item]));
    expect(onGridDragStop).toHaveBeenCalledWith([item], true);
  });

  it('hovering a tab 500ms hands the widget over; dropping on the canvas moves it and tracks', () => {
    const { result, setState, setDragPreviewTabId, onGridDragStop } = setup();
    act(() => result.current.handleDragStart([item], item, item, item, mouse(10, 10)));
    act(() => result.current.handleDrag([item], item, item, item, mouse(50, 5)));
    act(() => jest.advanceTimersByTime(CROSS_TAB_HOVER_DELAY_MS));
    expect(result.current.crossTabDrag).toMatchObject({ phase: 'handoff', targetTabId: 'dst' });
    expect(setDragPreviewTabId).toHaveBeenCalledWith('dst');

    // RGL's own stop for the source grid is ignored during a hand-off
    act(() => result.current.handleDragStop([item]));
    expect(onGridDragStop).not.toHaveBeenCalled();

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 120, clientY: 64 }));
    });
    expect(setState).toHaveBeenCalledTimes(1);
    const next = setState.mock.calls[0][0](editorState) as DashboardEditorState;
    expect(next.activeTabId).toBe('dst');
    expect(next.tabs[1].components['chart-1']).toBeDefined();
    expect(next.tabs[0].components['chart-1']).toBeUndefined();
    expect(trackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.DASHBOARD_WIDGET_MOVED_BETWEEN_TABS, {
      dashboard_id: 7,
      element_type: 'chart',
    });
    expect(result.current.crossTabDrag).toBeNull();
    expect(setDragPreviewTabId).toHaveBeenLastCalledWith(null);
  });

  it('Escape during a hand-off cancels without moving', () => {
    const { result, setState } = setup();
    act(() => result.current.handleDragStart([item], item, item, item, mouse(10, 10)));
    act(() => result.current.handleDrag([item], item, item, item, mouse(50, 5)));
    act(() => jest.advanceTimersByTime(CROSS_TAB_HOVER_DELAY_MS));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(setState).not.toHaveBeenCalled();
    expect(result.current.crossTabDrag).toBeNull();
  });
});
