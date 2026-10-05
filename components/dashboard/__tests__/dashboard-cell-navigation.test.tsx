import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DashboardCell } from '../DashboardCell';
import { DashboardComponentType } from '@/types/dashboard';
import type { DashboardFilterConfig } from '@/types/dashboard-filters';
import { TestWrapper } from '@/test-utils/render';
import { mockApiGet } from '@/test-utils/api';

jest.mock('../chart-element-v2', () => ({ ChartElementV2: () => <div>Chart preview</div> }));
jest.mock('../kpi-chart-element', () => ({ KPIChartElement: () => <div>KPI preview</div> }));
jest.mock('../text-element-unified', () => ({ UnifiedTextElement: () => <div>Text preview</div> }));

const baseProps = {
  item: { i: 'widget-1', x: 0, y: 0, w: 4, h: 4 },
  isAnimating: false,
  isBeingPushed: false,
  isDraggedComponent: false,
  spaceMakingActive: false,
  animationStyles: {},
  isResizing: false,
  appliedFilters: {},
  initialFilters: [] as DashboardFilterConfig[],
  onViewChart: jest.fn(),
  onEditChart: jest.fn(),
  onViewKpi: jest.fn(),
  onEditKpi: jest.fn(),
  onRemove: jest.fn(),
  onUpdate: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApiGet.mockReset();
});

const resources = [
  {
    label: 'KPI',
    type: DashboardComponentType.KPI,
    config: { kpiId: 17 },
    url: '/api/kpis/17/',
    id: 17,
    onView: baseProps.onViewKpi,
    onEdit: baseProps.onEditKpi,
  },
  {
    label: 'Chart',
    type: DashboardComponentType.CHART,
    config: { chartId: 23 },
    url: '/api/charts/23/',
    id: 23,
    onView: baseProps.onViewChart,
    onEdit: baseProps.onEditChart,
  },
];

describe.each(resources)('$label widget navigation', (resource) => {
  const component = { id: 'widget-1', type: resource.type, config: resource.config };

  it('offers View and Edit for the resource with effective edit access', async () => {
    mockApiGet.mockResolvedValue({ id: resource.id, access_level: 'edit' });
    render(<DashboardCell {...baseProps} component={component} />, { wrapper: TestWrapper });
    fireEvent.click(screen.getByTitle(`View ${resource.label}`));
    fireEvent.click(await screen.findByTitle(`Edit ${resource.label}`));
    expect(resource.onView).toHaveBeenCalledWith(resource.id);
    expect(resource.onEdit).toHaveBeenCalledWith(resource.id);
    expect(mockApiGet).toHaveBeenCalledWith(resource.url);
  });

  it.each(['view', undefined] as const)(
    'keeps View but hides Edit when resource access is %s',
    async (access_level) => {
      mockApiGet.mockResolvedValue({ id: resource.id, access_level });
      render(<DashboardCell {...baseProps} component={component} />, { wrapper: TestWrapper });
      await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith(resource.url));
      expect(screen.getByTitle(`View ${resource.label}`)).toBeInTheDocument();
      expect(screen.queryByTitle(`Edit ${resource.label}`)).not.toBeInTheDocument();
      expect(screen.getByTitle(`Remove ${resource.label} From Dashboard`)).toBeInTheDocument();
    }
  );

  it('hides Edit until access has loaded', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    render(<DashboardCell {...baseProps} component={component} />, { wrapper: TestWrapper });
    expect(screen.queryByTitle(`Edit ${resource.label}`)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle(`View ${resource.label}`));
    expect(resource.onView).toHaveBeenCalledWith(resource.id);
  });
});

it('does not request chart or KPI permissions for text elements', () => {
  render(
    <DashboardCell
      {...baseProps}
      component={{ id: 'widget-1', type: DashboardComponentType.TEXT, config: {} }}
    />,
    { wrapper: TestWrapper }
  );
  expect(screen.getByText('Text preview')).toBeInTheDocument();
  expect(mockApiGet).not.toHaveBeenCalled();
});
