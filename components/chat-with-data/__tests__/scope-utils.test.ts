import { dashboardHasChatableComponents } from '../scope-utils';

describe('dashboardHasChatableComponents', () => {
  it('is true when any tab has a chart component', () => {
    const tabs = [{ id: 't1', components: { c1: { type: 'chart', config: { chartId: 3 } } } }];
    expect(dashboardHasChatableComponents(tabs)).toBe(true);
  });

  it('is true when any tab has a KPI component', () => {
    const tabs = [{ id: 't1', components: { k1: { type: 'kpi', config: { kpiId: 9 } } } }];
    expect(dashboardHasChatableComponents(tabs)).toBe(true);
  });

  it('is false for text-only dashboards, empty tabs, or missing tabs', () => {
    expect(
      dashboardHasChatableComponents([
        { id: 't1', components: { x: { type: 'text', config: {} } } },
      ])
    ).toBe(false);
    expect(dashboardHasChatableComponents([])).toBe(false);
    expect(dashboardHasChatableComponents(undefined)).toBe(false);
  });
});
