import { render, screen } from '@testing-library/react';
import type { DashboardComponentType, DashboardComponentConfig } from '@/types/dashboard';
import { getChartViewUrl, WIDGET_NAVIGATION_SOURCES } from '@/lib/widget-navigation';
import { VIEW_WIDGETS, type ViewWidgetContext } from '@/components/dashboard/widgets/view-widgets';

const chartProps: Record<string, unknown>[] = [];
jest.mock('@/components/dashboard/widgets/chart/chart-element-view', () => ({
  ChartElementView: (props: Record<string, unknown>) => {
    chartProps.push(props);
    return <div data-testid="chart-view" />;
  },
}));
jest.mock('@/components/dashboard/widgets/kpi/kpi-chart-element', () => ({
  KPIChartElement: () => <div data-testid="kpi-view" />,
}));
jest.mock('@/components/dashboard/widgets/text/text-element-unified', () => ({
  UnifiedTextElement: () => <div data-testid="text-view" />,
}));
jest.mock('@/components/dashboard/filter-element', () => ({
  FilterElement: ({ filter }: { filter: { id: string } }) => (
    <div data-testid="filter-view" data-filter-id={filter.id} />
  ),
}));

const filterRow = (id: number) => ({
  id,
  dashboard_id: 1,
  name: `F${id}`,
  filter_type: 'value' as const,
  schema_name: 's',
  table_name: 't',
  column_name: `c${id}`,
  settings: {},
  order: 0,
  created_at: '',
  updated_at: '',
});

const ctx = (over: Partial<ViewWidgetContext> = {}): ViewWidgetContext => ({
  dashboardFilterRows: [filterRow(1), filterRow(2)],
  selectedFilters: {},
  dashboardFilterConfigs: [],
  isPublicMode: false,
  isReportMode: false,
  canModerateComments: false,
  orgLogoUrl: null,
  showWidgetNavigation: true,
  widgetNavigationSource: WIDGET_NAVIGATION_SOURCES.DASHBOARD,
  navigate: jest.fn(),
  onFilterChange: jest.fn(),
  ...over,
});

const widget = (type: string, config: Record<string, unknown>): DashboardComponentConfig => ({
  id: 'w-1',
  type: type as DashboardComponentType,
  config,
});

function renderWidget(type: string, config: Record<string, unknown>, c = ctx()) {
  const View = VIEW_WIDGETS[type];
  return render(<View componentId="w-1" component={widget(type, config)} ctx={c} />);
}

beforeEach(() => {
  chartProps.length = 0;
});

describe('VIEW_WIDGETS', () => {
  it('has one row per widget type the dashboard JSON can contain', () => {
    expect(Object.keys(VIEW_WIDGETS).sort()).toEqual(['chart', 'filter', 'heading', 'kpi', 'text']);
  });

  it('legacy heading: defaults to an h2 "Heading" in gray-800', () => {
    renderWidget('heading', {});
    const h = screen.getByRole('heading', { level: 2, name: 'Heading' });
    expect(h).toHaveClass('text-gray-900', 'font-semibold', 'text-xl');
    expect(h).toHaveStyle({ color: '#1f2937' });
  });

  it('legacy heading: level, text and colour from config', () => {
    renderWidget('heading', { level: 1, text: 'Top', color: '#ff0000' });
    expect(screen.getByRole('heading', { level: 1, name: 'Top' })).toHaveClass('text-2xl');
  });

  it('legacy filter: string filterId finds the numeric row', () => {
    renderWidget('filter', { filterId: '2' });
    expect(screen.getByTestId('filter-view')).toHaveAttribute('data-filter-id', '2');
  });

  it('legacy filter: falls back to its own config when it carries column_name', () => {
    renderWidget('filter', {
      id: 9,
      filterId: 9,
      name: 'Own',
      schema_name: 's',
      table_name: 't',
      column_name: 'state',
      filter_type: 'value',
      settings: {},
    });
    expect(screen.getByTestId('filter-view')).toHaveAttribute('data-filter-id', '9');
  });

  it('legacy filter: not found lists the available ids', () => {
    renderWidget('filter', { filterId: 5 });
    expect(screen.getByText('Filter not found: ID 5')).toBeInTheDocument();
    expect(screen.getByText('Available: 1, 2')).toBeInTheDocument();
  });

  it('chart: report mode passes the frozen config and comment props; navigation opens the chart', () => {
    const navigate = jest.fn();
    const frozen = { chart_type: 'bar' };
    renderWidget(
      'chart',
      { chartId: 12 },
      ctx({
        isReportMode: true,
        frozenChartConfigs: { '12': frozen as never },
        snapshotId: 3,
        canModerateComments: true,
        navigate,
      })
    );
    const props = chartProps[0];
    expect(props.chartId).toBe(12);
    expect(props.frozenChartConfig).toBe(frozen);
    expect(props.snapshotId).toBe(3);
    expect(props.canModerateComments).toBe(true);
    (props.onView as () => void)();
    expect(navigate).toHaveBeenCalledWith(getChartViewUrl(12, WIDGET_NAVIGATION_SOURCES.DASHBOARD));
  });

  it('chart: outside report mode no frozen config / comments; no navigation when hidden', () => {
    renderWidget('chart', { chartId: 12 }, ctx({ showWidgetNavigation: false, snapshotId: 3 }));
    const props = chartProps[0];
    expect(props.frozenChartConfig).toBeUndefined();
    expect(props.snapshotId).toBeUndefined();
    expect(props.canModerateComments).toBeUndefined();
    expect(props.onView).toBeUndefined();
  });
});
