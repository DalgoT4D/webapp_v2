import { render } from '@testing-library/react';
import { DashboardComponentType } from '@/types/dashboard';
import { BUILDER_WIDGETS } from '@/components/dashboard/widgets/builder-widgets';

const kpiProps: Record<string, unknown>[] = [];
jest.mock('@/components/dashboard/chart-element-v2', () => ({ ChartElementV2: () => <div /> }));
jest.mock('@/components/dashboard/text-element-unified', () => ({
  UnifiedTextElement: () => <div />,
}));
jest.mock('@/components/dashboard/kpi-chart-element', () => ({
  KPIChartElement: (props: Record<string, unknown>) => {
    kpiProps.push(props);
    return <div />;
  },
}));

describe('BUILDER_WIDGETS', () => {
  it('chart, KPI and text only (legacy heading/filter cannot be built)', () => {
    expect(Object.keys(BUILDER_WIDGETS).sort()).toEqual(['chart', 'kpi', 'text']);
  });

  it('builder KPI gets no dashboard filters (pinned)', () => {
    // PINNED-BUGS: "Builder KPIs ignore dashboard filters"
    const Kpi = BUILDER_WIDGETS.kpi;
    render(
      <Kpi
        item={{ i: 'kpi-1', x: 0, y: 0, w: 12, h: 11 }}
        component={{ id: 'kpi-1', type: DashboardComponentType.KPI, config: { kpiId: 441 } }}
        isResizing={false}
        appliedFilters={{ '5': ['Assam'] }}
        initialFilters={[]}
        onRemove={jest.fn()}
        onUpdate={jest.fn()}
      />
    );
    expect(kpiProps[0]).toEqual({ kpiId: 441, config: { kpiId: 441 }, isResizing: false });
  });
});
