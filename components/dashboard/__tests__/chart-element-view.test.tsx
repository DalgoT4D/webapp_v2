/**
 * ChartElementView dashboard_id wiring. The chart GET endpoints 403 Members
 * without a dashboard_id query param, so the dashboard view page must pass
 * it per tile; the chart builder / standalone Charts page must not.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet, mockApiPost } from '@/test-utils/api';
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

const TABLE_CHART = {
  id: 43,
  title: 'Signups by region',
  chart_type: ChartTypes.TABLE,
  computation_type: 'raw',
  schema_name: 'public',
  table_name: 'signups',
  extra_config: {},
};

const MAP_CHART = {
  id: 44,
  title: 'District population',
  chart_type: ChartTypes.MAP,
  computation_type: 'aggregated',
  schema_name: 'public',
  table_name: 'districts',
  extra_config: {
    geographic_column: 'district_name',
    value_column: 'population',
    aggregate_function: 'sum',
    selected_geojson_id: 1,
  },
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

// The chart-data-preview and map-data-overlay POSTs are gated on
// chart_id + dashboard_id when a dashboard tile is asking. The dashboard
// view's table/map tiles must send them; the builder must not.
describe('ChartElementView — table tile access context (Task 6c)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockResolvedValue(TABLE_CHART);
    mockApiPost.mockResolvedValue({ data: [], total_rows: 0 });
  });

  it('sends chart_id and dashboard_id on the table preview POST inside a dashboard view', async () => {
    render(<ChartElementView chartId={43} dashboardId={7} viewMode isPublicMode={false} />, {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      const previewCall = mockApiPost.mock.calls.find(([url]) =>
        (url as string).includes('/api/charts/chart-data-preview/')
      );
      expect(previewCall).toBeDefined();
      expect(previewCall![0]).toContain('chart_id=43');
      expect(previewCall![0]).toContain('dashboard_id=7');
    });
  });

  it('sends chart_id and dashboard_id on the table total-rows POST inside a dashboard view', async () => {
    render(<ChartElementView chartId={43} dashboardId={7} viewMode isPublicMode={false} />, {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      const totalRowsCall = mockApiPost.mock.calls.find(([url]) =>
        (url as string).includes('/api/charts/chart-data-preview/total-rows/')
      );
      expect(totalRowsCall).toBeDefined();
      expect(totalRowsCall![0]).toContain('chart_id=43');
      expect(totalRowsCall![0]).toContain('dashboard_id=7');
    });
  });

  it('still sends chart_id but omits dashboard_id when no dashboard context is given', async () => {
    // ChartElementView always represents one specific saved chart (chartId is a
    // required prop), so chart_id travels regardless — the same way the chart's
    // id is always in the URL path for the GET endpoints above. dashboard_id is
    // the part that's tile-context-only.
    render(<ChartElementView chartId={43} viewMode isPublicMode={false} />, {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      const previewCall = mockApiPost.mock.calls.find(([url]) =>
        (url as string).includes('/api/charts/chart-data-preview/')
      );
      expect(previewCall).toBeDefined();
      expect(previewCall![0]).toContain('chart_id=43');
      expect(previewCall![0]).not.toContain('dashboard_id');
    });
  });
});

describe('ChartElementView — map tile access context (Task 6c)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockResolvedValue(MAP_CHART);
    mockApiPost.mockResolvedValue({ data: [] });
  });

  it('sends chart_id and dashboard_id as body fields on the map-data-overlay POST inside a dashboard view', async () => {
    render(<ChartElementView chartId={44} dashboardId={7} viewMode isPublicMode={false} />, {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      const mapCall = mockApiPost.mock.calls.find(
        ([url]) => url === '/api/charts/map-data-overlay/'
      );
      expect(mapCall).toBeDefined();
      expect(mapCall![1]).toMatchObject({ chart_id: 44, dashboard_id: 7 });
    });
  });

  it('still sends chart_id but omits dashboard_id when no dashboard context is given', async () => {
    render(<ChartElementView chartId={44} viewMode isPublicMode={false} />, {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      const mapCall = mockApiPost.mock.calls.find(
        ([url]) => url === '/api/charts/map-data-overlay/'
      );
      expect(mapCall).toBeDefined();
      expect(mapCall![1]).toMatchObject({ chart_id: 44 });
      expect(mapCall![1]).not.toHaveProperty('dashboard_id');
    });
  });
});
