/**
 * Tests for ChartElementView's dashboard_id wiring.
 *
 * Backend contract (task-04): GET /api/charts/{id}/ and GET /api/charts/{id}/data/
 * 403 Members without a `dashboard_id` query param — charts are only visible in
 * dashboard context for that role. The dashboard VIEW page must pass it per tile;
 * the chart builder / standalone Charts page must not (untouched, out of scope here).
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';
import { ChartElementView } from '../chart-element-view';
import { ChartTypes } from '@/types/charts';

// Mock echarts — we only care about network calls here, not rendering.
jest.mock('echarts/core', () => ({
  use: jest.fn(),
  init: jest.fn(() => ({
    setOption: jest.fn(),
    dispose: jest.fn(),
    resize: jest.fn(),
    clear: jest.fn(),
    getOption: jest.fn(),
  })),
}));
jest.mock('echarts/charts', () => ({
  BarChart: {},
  LineChart: {},
  PieChart: {},
  GaugeChart: {},
  ScatterChart: {},
  HeatmapChart: {},
  MapChart: {},
}));
jest.mock('echarts/components', () => ({
  TitleComponent: {},
  TooltipComponent: {},
  GridComponent: {},
  LegendComponent: {},
  DatasetComponent: {},
  ToolboxComponent: {},
  DataZoomComponent: {},
  VisualMapComponent: {},
  GeoComponent: {},
}));
jest.mock('echarts/renderers', () => ({ CanvasRenderer: {} }));

// Heavy chart-type-specific renderers — irrelevant to the number-chart path used here.
jest.mock('@/components/charts/map/MapPreview', () => ({
  MapPreview: () => <div data-testid="map-preview" />,
}));
jest.mock('@/components/charts/TableChart', () => ({
  TableChart: () => <div data-testid="table-chart" />,
}));
jest.mock('@/components/charts/DataPreview', () => ({
  DataPreview: () => <div data-testid="data-preview" />,
}));
jest.mock('@/components/reports/comment-popover', () => ({
  CommentPopover: () => <div data-testid="comment-popover" />,
}));

const NUMBER_CHART = {
  id: 42,
  title: 'Total signups',
  chart_type: ChartTypes.NUMBER,
  computation_type: 'aggregated',
  schema_name: 'public',
  table_name: 'signups',
  extra_config: {},
};

describe('ChartElementView — dashboard_id wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockResolvedValue(NUMBER_CHART);
  });

  it('includes dashboard_id on the chart metadata fetch when rendered inside a dashboard view', async () => {
    render(<ChartElementView chartId={42} dashboardId={7} viewMode isPublicMode={false} />, {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/charts\/42\/\?dashboard_id=7$/)
      );
    });
  });

  it('includes dashboard_id on the chart data fetch when rendered inside a dashboard view', async () => {
    render(<ChartElementView chartId={42} dashboardId={7} viewMode isPublicMode={false} />, {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/charts\/42\/data\/\?dashboard_id=7$/)
      );
    });
  });

  it('omits dashboard_id when no dashboard context is given (builder / standalone usage)', async () => {
    render(<ChartElementView chartId={42} viewMode isPublicMode={false} />, {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/charts/42/');
    });

    const calledUrls = mockApiGet.mock.calls.map((call) => call[0]);
    expect(calledUrls.some((url: string) => url.includes('dashboard_id'))).toBe(false);
  });

  it('does not fetch chart metadata at all in public mode (dashboard_id never applies there)', async () => {
    render(
      <ChartElementView chartId={42} dashboardId={7} viewMode isPublicMode publicToken="tok-123" />,
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      const calledUrls = mockApiGet.mock.calls.map((call) => call[0]);
      expect(calledUrls.some((url: string) => url.startsWith('/api/charts/'))).toBe(false);
    });
  });
});
