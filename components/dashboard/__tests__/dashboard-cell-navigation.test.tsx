import { fireEvent, render, screen } from '@testing-library/react';
import { DashboardCell } from '../DashboardCell';
import { DashboardComponentType } from '@/types/dashboard';
import type { DashboardFilterConfig } from '@/types/dashboard-filters';

jest.mock('../chart-element-v2', () => ({
  ChartElementV2: () => <div>Chart preview</div>,
}));

jest.mock('../kpi-chart-element', () => ({
  KPIChartElement: () => <div>KPI preview</div>,
}));

jest.mock('../text-element-unified', () => ({
  UnifiedTextElement: () => <div>Text preview</div>,
}));

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
  canEditCharts: true,
  canEditKpis: true,
  onRemove: jest.fn(),
  onUpdate: jest.fn(),
};

describe('DashboardCell widget navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers the same View and Edit actions for a KPI as for a chart', () => {
    const { rerender } = render(
      <DashboardCell
        {...baseProps}
        component={{ id: 'widget-1', type: DashboardComponentType.KPI, config: { kpiId: 17 } }}
      />
    );

    fireEvent.click(screen.getByTitle('View KPI'));
    fireEvent.click(screen.getByTitle('Edit KPI'));
    expect(baseProps.onViewKpi).toHaveBeenCalledWith(17);
    expect(baseProps.onEditKpi).toHaveBeenCalledWith(17);

    rerender(
      <DashboardCell
        {...baseProps}
        component={{
          id: 'widget-1',
          type: DashboardComponentType.CHART,
          config: { chartId: 23 },
        }}
      />
    );

    fireEvent.click(screen.getByTitle('View Chart'));
    fireEvent.click(screen.getByTitle('Edit Chart'));
    expect(baseProps.onViewChart).toHaveBeenCalledWith(23);
    expect(baseProps.onEditChart).toHaveBeenCalledWith(23);
  });

  it('keeps View available while hiding Edit without the matching permission', () => {
    const { rerender } = render(
      <DashboardCell
        {...baseProps}
        canEditKpis={false}
        component={{ id: 'widget-1', type: DashboardComponentType.KPI, config: { kpiId: 17 } }}
      />
    );

    expect(screen.getByTitle('View KPI')).toBeInTheDocument();
    expect(screen.queryByTitle('Edit KPI')).not.toBeInTheDocument();

    rerender(
      <DashboardCell
        {...baseProps}
        canEditCharts={false}
        component={{
          id: 'widget-1',
          type: DashboardComponentType.CHART,
          config: { chartId: 23 },
        }}
      />
    );

    expect(screen.getByTitle('View Chart')).toBeInTheDocument();
    expect(screen.queryByTitle('Edit Chart')).not.toBeInTheDocument();
  });
});
