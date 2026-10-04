import { act, renderHook } from '@testing-library/react';
import type { KeyedMutator } from 'swr';
import type { ChartListResponse } from '@/hooks/api/useCharts';
import { trackEvent } from '@/lib/analytics';
import { toastError, toastSuccess } from '@/lib/toast';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { useChartSelection } from '@/components/charts/list/useChartSelection';
import { useChartFavoriteToggle } from '@/components/charts/list/useChartFavoriteToggle';
import { useDuplicateChart } from '@/components/charts/list/useDuplicateChart';
import { makeChart } from './chart-fixtures';

const mockBulkDelete = jest.fn();
const mockFavorite = jest.fn();
const mockUnfavorite = jest.fn();
const mockCreateChart = jest.fn();
jest.mock('@/hooks/api/useChart', () => ({
  useBulkDeleteCharts: () => ({ trigger: mockBulkDelete }),
  useFavoriteChart: () => ({ trigger: mockFavorite }),
  useUnfavoriteChart: () => ({ trigger: mockUnfavorite }),
  useCreateChart: () => ({ trigger: mockCreateChart }),
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn(), duplicated: jest.fn() },
  toastError: { delete: jest.fn(), update: jest.fn(), duplicate: jest.fn(), load: jest.fn() },
}));
jest.mock('@/components/charts/utils', () => ({
  getMetricAnalyticsProps: () => ({ metric_count: 0 }),
  isDrillDownEnabled: () => false,
}));

const asMutate = (fn: jest.Mock) => fn as unknown as KeyedMutator<ChartListResponse>;

beforeEach(() => jest.clearAllMocks());

describe('useChartSelection', () => {
  const visible = [
    makeChart({ id: 1, title: 'A' }),
    makeChart({ id: 2, title: 'B' }),
    makeChart({ id: 3, title: 'C' }),
  ];
  const setup = (confirmResult = true) => {
    const confirm = jest.fn().mockResolvedValue(confirmResult);
    const deleteChart = jest.fn().mockResolvedValue(undefined);
    const mutate = jest.fn().mockResolvedValue(undefined);
    const hook = renderHook(() =>
      useChartSelection({ visibleCharts: visible, confirm, deleteChart, mutate: asMutate(mutate) })
    );
    return { ...hook, confirm, deleteChart, mutate };
  };

  it('enter / toggle / select all / deselect all / exit', () => {
    const { result } = setup();
    act(() => result.current.enterSelectionMode(1));
    expect(result.current.isSelectionMode).toBe(true);
    expect([...result.current.selectedCharts]).toEqual([1]);
    act(() => result.current.toggleChartSelection(2));
    act(() => result.current.toggleChartSelection(1));
    expect([...result.current.selectedCharts]).toEqual([2]);
    act(() => result.current.selectAllCharts());
    expect([...result.current.selectedCharts]).toEqual([1, 2, 3]);
    act(() => result.current.deselectAllCharts());
    expect(result.current.selectedCharts.size).toBe(0);
    act(() => result.current.exitSelectionMode());
    expect(result.current.isSelectionMode).toBe(false);
  });

  it('bulk delete: confirm lists titles, bulk endpoint, tracks, refetches, toasts, exits', async () => {
    mockBulkDelete.mockResolvedValue(undefined);
    const { result, confirm, mutate } = setup();
    act(() => result.current.enterSelectionMode(1));
    act(() => result.current.toggleChartSelection(2));
    await act(() => result.current.handleBulkDelete());
    expect(confirm).toHaveBeenCalledWith({
      title: 'Delete Charts',
      description:
        'This will permanently delete 2 charts. This action cannot be undone.\n\nCharts to delete:\n• A\n• B',
      confirmText: 'Delete',
      type: 'warning',
      testIdPrefix: 'chart-bulk-delete-confirm',
      onConfirm: expect.any(Function),
    });
    expect(mockBulkDelete).toHaveBeenCalledWith([1, 2]);
    expect(trackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.CHARTS_BULK_DELETED, {
      count: 2,
      chart_ids: [1, 2],
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(toastSuccess.generic).toHaveBeenCalledWith('2 charts deleted successfully');
    expect(result.current.isSelectionMode).toBe(false);
  });

  it('falls back to one DELETE per chart when the bulk endpoint fails', async () => {
    mockBulkDelete.mockRejectedValue(new Error('404'));
    const { result, deleteChart } = setup();
    act(() => result.current.enterSelectionMode(1));
    act(() => result.current.toggleChartSelection(3));
    await act(() => result.current.handleBulkDelete());
    expect(deleteChart.mock.calls).toEqual([[1], [3]]);
    expect(toastSuccess.generic).toHaveBeenCalledWith('2 charts deleted successfully');
  });

  it('single chart: singular confirm text; Cancel keeps the selection', async () => {
    const { result, confirm } = setup(false);
    act(() => result.current.enterSelectionMode(3));
    await act(() => result.current.handleBulkDelete());
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Delete Chart',
        description: 'This will permanently delete "C". This action cannot be undone.',
      })
    );
    expect(mockBulkDelete).not.toHaveBeenCalled();
    expect(result.current.isSelectionMode).toBe(true);
  });
});

describe('useChartFavoriteToggle', () => {
  it('flips the star optimistically without refetching on success', async () => {
    mockFavorite.mockResolvedValue(undefined);
    const mutate = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useChartFavoriteToggle(asMutate(mutate)));
    await act(() => result.current.handleToggleFavorite(makeChart({ id: 1, is_favorite: false })));

    const [updater, options] = mutate.mock.calls[0];
    expect(options).toEqual({ revalidate: false });
    const page: ChartListResponse = {
      data: [makeChart({ id: 1, is_favorite: false }), makeChart({ id: 2, is_favorite: true })],
      total: 2,
      page: 1,
      page_size: 10,
      total_pages: 1,
    };
    expect(updater(page).data.map((c: { is_favorite?: boolean }) => c.is_favorite)).toEqual([
      true,
      true,
    ]);
    expect(updater(undefined)).toBeUndefined();
    expect(mockFavorite).toHaveBeenCalledWith(1);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(result.current.favoritingIds.size).toBe(0);
  });

  it('rolls back with a refetch and toasts on failure', async () => {
    const error = new Error('boom');
    mockUnfavorite.mockRejectedValue(error);
    const mutate = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useChartFavoriteToggle(asMutate(mutate)));
    await act(() => result.current.handleToggleFavorite(makeChart({ id: 4, is_favorite: true })));
    expect(mockUnfavorite).toHaveBeenCalledWith(4);
    expect(mutate.mock.calls[1]).toEqual([]);
    expect(toastError.update).toHaveBeenCalledWith(error, 'favorite');
  });
});

describe('useDuplicateChart', () => {
  it('creates "Copy of X (2)", tracks CHART_CREATED source=duplicate, refetches, toasts', async () => {
    mockCreateChart.mockResolvedValue({ id: 99 });
    const mutate = jest.fn().mockResolvedValue(undefined);
    const charts = [
      makeChart({ id: 1, title: 'Students' }),
      makeChart({ id: 2, title: 'Copy of Students' }),
    ];
    const { result } = renderHook(() => useDuplicateChart(charts, asMutate(mutate)));
    await act(() => result.current.handleDuplicateChart(1, 'Students'));
    expect(mockCreateChart).toHaveBeenCalledWith({
      title: 'Copy of Students (2)',
      chart_type: 'bar',
      computation_type: 'aggregated',
      schema_name: 'public',
      table_name: 'students',
      extra_config: {},
    });
    expect(trackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.CHART_CREATED, {
      chart_type: 'bar',
      chart_id: 99,
      source: 'duplicate',
      metric_count: 0,
      drill_down_enabled: false,
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(toastSuccess.duplicated).toHaveBeenCalledWith('Students', 'Copy of Students (2)');
    expect(result.current.duplicatingChartId).toBeNull();
  });

  it('toasts with the clicked title on failure', async () => {
    const error = new Error('500');
    mockCreateChart.mockRejectedValue(error);
    const { result } = renderHook(() =>
      useDuplicateChart([makeChart({ id: 1 })], asMutate(jest.fn()))
    );
    await act(() => result.current.handleDuplicateChart(1, 'Students'));
    expect(toastError.duplicate).toHaveBeenCalledWith(error, 'Students');
  });
});
