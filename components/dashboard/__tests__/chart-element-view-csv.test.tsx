/**
 * v1.1 M3b (task 6): the authed dashboard-tile CSV export must carry
 * chart_id + dashboard_id — the M2 warehouse gate treats a bare raw payload
 * as Analyst-only, so without the chart context a Member's tile export 403s.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestWrapper } from '@/test-utils/render';
import { ChartElementView } from '../chart-element-view';
import { ChartTypes } from '@/types/charts';
import * as api from '@/lib/api';

// The global jest.setup mock omits apiPostBinary (the CSV endpoint helper) —
// this suite needs it, so it declares the full module mock itself.
jest.mock('@/lib/api', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
  apiPut: jest.fn(),
  apiPatch: jest.fn(),
  apiDelete: jest.fn(),
  apiPostBinary: jest.fn(),
}));

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

// Mock echarts + heavy renderers (same set as chart-element-view.test.tsx).
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

const mockApiGet = api.apiGet as jest.Mock;
const mockApiPost = api.apiPost as jest.Mock;
const mockApiPostBinary = (api as unknown as { apiPostBinary: jest.Mock }).apiPostBinary;

const TABLE_CHART = {
  id: 43,
  title: 'Signups by region',
  chart_type: ChartTypes.TABLE,
  computation_type: 'raw',
  schema_name: 'public',
  table_name: 'signups',
  extra_config: {},
};

async function exportCsv() {
  const user = userEvent.setup();
  await user.click(screen.getByTitle('Download'));
  await user.click(await screen.findByText('Export Data as CSV'));
}

describe('ChartElementView — CSV export access context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockResolvedValue(TABLE_CHART);
    mockApiPost.mockResolvedValue({ data: [], total_rows: 0 });
    mockApiPostBinary.mockResolvedValue(new Blob(['a,b\n1,2']));
  });

  it('sends chart_id and dashboard_id on the authed tile export', async () => {
    render(<ChartElementView chartId={43} dashboardId={7} viewMode isPublicMode={false} />, {
      wrapper: TestWrapper,
    });
    await waitFor(() => expect(screen.getByTitle('Download')).toBeInTheDocument());

    await exportCsv();

    await waitFor(() => expect(mockApiPostBinary).toHaveBeenCalled());
    const [url] = mockApiPostBinary.mock.calls[0];
    expect(url).toContain('/api/charts/download-csv/');
    expect(url).toContain('chart_id=43');
    expect(url).toContain('dashboard_id=7');
  });

  it('sends chart_id but omits dashboard_id outside a dashboard context', async () => {
    render(<ChartElementView chartId={43} viewMode isPublicMode={false} />, {
      wrapper: TestWrapper,
    });
    await waitFor(() => expect(screen.getByTitle('Download')).toBeInTheDocument());

    await exportCsv();

    await waitFor(() => expect(mockApiPostBinary).toHaveBeenCalled());
    const [url] = mockApiPostBinary.mock.calls[0];
    expect(url).toContain('chart_id=43');
    expect(url).not.toContain('dashboard_id');
  });
});
