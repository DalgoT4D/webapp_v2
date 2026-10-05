import { act, renderHook } from '@testing-library/react';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS, DASHBOARD_FILTER_CONTEXTS } from '@/constants/analytics';
import {
  DashboardFilterType,
  type DashboardFilterConfig,
  type ValueFilterSettings,
} from '@/types/dashboard-filters';
import {
  APPLY_FILTERS_DELAY_MS,
  useFiltersPanel,
  type UseFiltersPanelOptions,
} from '@/components/dashboard/filters/useFiltersPanel';

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
const mockGlobalMutate = jest.fn();
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
  useSWRConfig: () => ({ mutate: mockGlobalMutate }),
}));

const valueFilter = (id: string, extra: Record<string, unknown> = {}): DashboardFilterConfig => ({
  id,
  name: `F${id}`,
  schema_name: 's',
  table_name: 't',
  column_name: `c${id}`,
  filter_type: DashboardFilterType.VALUE,
  settings: {
    has_default_value: false,
    can_select_multiple: true,
    ...extra,
  } as ValueFilterSettings,
  position: { x: 0, y: 0, w: 4, h: 3 },
});

function setup(over: Partial<UseFiltersPanelOptions> = {}) {
  const options: UseFiltersPanelOptions = {
    initialFilters: [valueFilter('1'), valueFilter('2')],
    dashboardId: 7,
    isEditMode: false,
    isPublicMode: false,
    isReportMode: false,
    initiallyCollapsed: false,
    onFiltersApplied: jest.fn(),
    onFiltersCleared: jest.fn(),
    onCollapseChange: jest.fn(),
    ...over,
  };
  return { options, ...renderHook(() => useFiltersPanel(options)) };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

describe('useFiltersPanel', () => {
  it('Apply waits 500ms, sends every filter (unset → null) and tracks counts with the context', async () => {
    const { result, options } = setup();
    act(() => result.current.handleFilterChange('2', ['Assam']));
    expect(result.current.hasActiveFilters).toBe(true);
    let applying: Promise<void> = Promise.resolve();
    act(() => {
      applying = result.current.handleApplyFilters();
    });
    expect(result.current.isApplyingFilters).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(APPLY_FILTERS_DELAY_MS);
      await applying;
    });
    expect(options.onFiltersApplied).toHaveBeenCalledWith({ '1': null, '2': ['Assam'] });
    expect(trackEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.DASHBOARD_FILTER_APPLIED,
      expect.objectContaining({ dashboard_id: 7, context: DASHBOARD_FILTER_CONTEXTS.VIEW })
    );
    expect(result.current.isApplyingFilters).toBe(false);
  });

  it('a public report has dashboard id 0 → dashboard_id undefined, context "report"', async () => {
    const { result } = setup({ dashboardId: 0, isReportMode: true, isPublicMode: true });
    let applying: Promise<void> = Promise.resolve();
    act(() => {
      applying = result.current.handleApplyFilters();
    });
    await act(async () => {
      jest.advanceTimersByTime(APPLY_FILTERS_DELAY_MS);
      await applying;
    });
    expect(trackEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.DASHBOARD_FILTER_APPLIED,
      expect.objectContaining({
        dashboard_id: undefined,
        context: DASHBOARD_FILTER_CONTEXTS.REPORT,
      })
    );
  });

  it('Clear all: dashboard → empty values + onFiltersCleared; report → defaults re-applied', () => {
    const { result, options } = setup();
    act(() => result.current.handleFilterChange('1', ['x']));
    act(() => result.current.handleClearAllFilters());
    expect(result.current.currentFilterValues).toEqual({});
    expect(options.onFiltersCleared).toHaveBeenCalledTimes(1);

    const report = setup({
      isReportMode: true,
      initialFilters: [valueFilter('1', { has_default_value: true, default_value: 'Assam' })],
    });
    act(() => report.result.current.handleFilterChange('1', 'Bihar'));
    act(() => report.result.current.handleClearAllFilters());
    expect(report.result.current.currentFilterValues).toEqual({ '1': 'Assam' });
    expect(report.options.onFiltersApplied).toHaveBeenCalledWith({ '1': 'Assam' });
  });

  it('report mode: a locked filter does not light the "applied" dot', () => {
    const { result } = setup({
      isReportMode: true,
      initialFilters: [
        valueFilter('1', { has_default_value: true, default_value: 'Assam', locked: true }),
      ],
    });
    expect(result.current.currentFilterValues).toEqual({ '1': 'Assam' });
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('collapse toggles notify the parent; the list toggle is local', () => {
    const { result, options } = setup();
    act(() => result.current.togglePanelCollapse());
    expect(result.current.isCollapsed).toBe(true);
    expect(options.onCollapseChange).toHaveBeenCalledWith(true);
    act(() => result.current.toggleFiltersExpansion());
    expect(result.current.isFiltersExpanded).toBe(false);
  });
});
