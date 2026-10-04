import { act, renderHook } from '@testing-library/react';
import type { ChartBuilderFormData } from '@/types/charts';
import { useSaveNewChart } from '@/components/charts/hooks/useSaveNewChart';
import { trackEvent } from '@/lib/analytics';
import { toastError, toastSuccess } from '@/lib/toast';
import { markChartCreated } from '@/components/onboarding/insight-walkthrough-constants';
import { ANALYTICS_EVENTS, CHART_CREATE_SOURCES, METRIC_USE_SOURCES } from '@/constants/analytics';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
}));

const mockCreateChart = jest.fn();
jest.mock('@/hooks/api/useChart', () => ({
  useCreateChart: () => ({ trigger: mockCreateChart, isMutating: false }),
}));

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { created: jest.fn() },
  toastError: { api: jest.fn() },
}));
jest.mock('@/components/onboarding/insight-walkthrough-constants', () => ({
  isStageBefore: jest.fn(() => false),
  markChartCreated: jest.fn(),
}));
jest.mock('@/stores/insightWalkthroughStore', () => ({
  useInsightWalkthroughStore: { getState: () => ({ active: false }) },
}));

const config: ChartBuilderFormData = {
  title: 'Sales',
  chart_type: 'bar',
  computation_type: 'aggregated',
  schema_name: 'public',
  table_name: 'sales',
  dimension_column: 'region',
  metrics: [{ column: 'amount', aggregation: 'sum', saved_metric_id: 7 }],
  customizations: {},
};

function renderSave(isFromDashboard: boolean, cfg: ChartBuilderFormData = config) {
  const markSaved = jest.fn();
  const { result } = renderHook(() => useSaveNewChart({ config: cfg, isFromDashboard, markSaved }));
  return { result, markSaved };
}

describe('useSaveNewChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockCreateChart.mockResolvedValue({ id: 42 });
  });

  it('creates, tracks CHART_CREATED then METRIC_USED, toasts and pushes to the chart', async () => {
    const { result, markSaved } = renderSave(false);
    await act(() => result.current.handleSave());

    expect(mockCreateChart).toHaveBeenCalledTimes(1);
    const events = (trackEvent as jest.Mock).mock.calls;
    expect(events.map((c) => c[0])).toEqual([
      ANALYTICS_EVENTS.CHART_CREATED,
      ANALYTICS_EVENTS.METRIC_USED,
    ]);
    expect(events[0][1]).toMatchObject({
      chart_type: 'bar',
      chart_id: 42,
      source: CHART_CREATE_SOURCES.NEW,
    });
    expect(events[1][1]).toEqual({
      metric_id: 7,
      chart_id: 42,
      source: METRIC_USE_SOURCES.CHART,
    });
    expect(markSaved).toHaveBeenCalled();
    expect(toastSuccess.created).toHaveBeenCalledWith('Chart');
    expect(markChartCreated).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/charts/42');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('from a dashboard: dashboard source and router.replace', async () => {
    const { result } = renderSave(true);
    await act(() => result.current.handleSave());
    expect((trackEvent as jest.Mock).mock.calls[0][1].source).toBe(
      CHART_CREATE_SOURCES.NEW_FROM_DASHBOARD
    );
    expect(mockReplace).toHaveBeenCalledWith('/charts/42?from=dashboard');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does nothing when the chart cannot be saved', async () => {
    const { result } = renderSave(false, { ...config, title: '' });
    await act(() => result.current.handleSave());
    expect(mockCreateChart).not.toHaveBeenCalled();
  });

  it('shows the API error toast when create fails', async () => {
    const error = new Error('boom');
    mockCreateChart.mockRejectedValue(error);
    const { result, markSaved } = renderSave(false);
    await act(() => result.current.handleSave());
    expect(toastError.api).toHaveBeenCalledWith(error, 'save chart');
    expect(markSaved).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
