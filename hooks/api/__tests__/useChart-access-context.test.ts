/**
 * Access-context params on the table/map chart-data hooks. Dashboard-view
 * tiles must send chart_id + dashboard_id; the chart builder and standalone
 * Charts page must not — their requests must stay byte-identical.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { TestWrapper } from '@/test-utils/render';
import { mockApiPost } from '@/test-utils/api';
import {
  useChartDataPreview,
  useChartDataPreviewTotalRows,
  useMapDataOverlay,
} from '@/hooks/api/useChart';
import type { ChartDataPayload } from '@/types/charts';
import type { MapDataOverlayRawPayload } from '@/hooks/api/useChart';

const chartDataPayload: ChartDataPayload = {
  chart_type: 'table',
  computation_type: 'raw',
  schema_name: 'public',
  table_name: 'orders',
};

const mapPayload: MapDataOverlayRawPayload = {
  schema_name: 'public',
  table_name: 'districts',
  geographic_column: 'district_name',
  value_column: 'population',
  aggregate_function: 'sum',
};

describe('useChartDataPreview — access context', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends chart_id and dashboard_id as query params for a dashboard tile', async () => {
    mockApiPost.mockResolvedValue({ data: [] });

    renderHook(() => useChartDataPreview(chartDataPayload, 1, 50, {}, 42, 7), {
      wrapper: TestWrapper,
    });

    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());

    const [url] = mockApiPost.mock.calls[0];
    expect(url).toContain('chart_id=42');
    expect(url).toContain('dashboard_id=7');
  });

  it('omits chart_id/dashboard_id for the builder/standalone path (no ids passed)', async () => {
    mockApiPost.mockResolvedValue({ data: [] });

    renderHook(() => useChartDataPreview(chartDataPayload, 1, 50, {}), {
      wrapper: TestWrapper,
    });

    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());

    const [url] = mockApiPost.mock.calls[0];
    expect(url).not.toContain('chart_id');
    expect(url).not.toContain('dashboard_id');
  });
});

describe('useChartDataPreviewTotalRows — access context', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends chart_id and dashboard_id as query params for a dashboard tile', async () => {
    mockApiPost.mockResolvedValue({ total_rows: 0 });

    renderHook(() => useChartDataPreviewTotalRows(chartDataPayload, {}, 42, 7), {
      wrapper: TestWrapper,
    });

    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());

    const [url] = mockApiPost.mock.calls[0];
    expect(url).toContain('chart_id=42');
    expect(url).toContain('dashboard_id=7');
  });

  it('omits chart_id/dashboard_id for the builder/standalone path (no ids passed)', async () => {
    mockApiPost.mockResolvedValue({ total_rows: 0 });

    renderHook(() => useChartDataPreviewTotalRows(chartDataPayload, {}), {
      wrapper: TestWrapper,
    });

    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());

    const [url] = mockApiPost.mock.calls[0];
    expect(url).not.toContain('chart_id');
    expect(url).not.toContain('dashboard_id');
  });
});

describe('useMapDataOverlay — access context', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends chart_id and dashboard_id as body fields for a dashboard tile', async () => {
    mockApiPost.mockResolvedValue({ data: [] });

    renderHook(() => useMapDataOverlay(mapPayload, 42, 7), { wrapper: TestWrapper });

    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());

    const [url, body] = mockApiPost.mock.calls[0];
    expect(url).toBe('/api/charts/map-data-overlay/');
    expect(body).toMatchObject({ chart_id: 42, dashboard_id: 7 });
  });

  it('omits chart_id/dashboard_id for the builder/standalone path (no ids passed)', async () => {
    mockApiPost.mockResolvedValue({ data: [] });

    renderHook(() => useMapDataOverlay(mapPayload), { wrapper: TestWrapper });

    await waitFor(() => expect(mockApiPost).toHaveBeenCalled());

    const [, body] = mockApiPost.mock.calls[0];
    expect(body).not.toHaveProperty('chart_id');
    expect(body).not.toHaveProperty('dashboard_id');
  });
});
