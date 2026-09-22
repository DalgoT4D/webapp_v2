import React from 'react';
import { render } from '@testing-library/react';
import { KpiMetricStep } from '../KpiMetricStep';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import type { WalkthroughStage } from '@/components/onboarding/insight-walkthrough-constants';

// Stands in for the real picker so the assertion is on the prop the step passes down, not on
// the combobox's rendered options — those are MetricPicker's own test.
const metricPickerProps = jest.fn();
jest.mock('@/components/metrics/MetricPicker', () => ({
  MetricPicker: (props: Record<string, unknown>) => {
    metricPickerProps(props);
    return <div data-testid="metric-picker" />;
  },
}));

jest.mock('@/hooks/api/useWarehouse', () => ({
  useTableColumns: (): { data: unknown[]; isLoading: boolean } => ({
    data: [],
    isLoading: false,
  }),
}));

function renderStep() {
  return render(
    <KpiMetricStep
      metricId={null}
      onMetricSelected={jest.fn()}
      onInlineMetricCreated={jest.fn()}
      mutateMetrics={jest.fn()}
    />
  );
}

function setWalkthrough(active: boolean, stage: WalkthroughStage | null) {
  useInsightWalkthroughStore.setState({ active, stage, path: 'sample', flow: 'insights' });
}

/** The `maxItems` the step handed the picker on its most recent render. */
function passedMaxItems(): number | undefined {
  const calls = metricPickerProps.mock.calls;
  return calls[calls.length - 1][0].maxItems;
}

describe('KpiMetricStep during the walkthrough', () => {
  beforeEach(() => {
    metricPickerProps.mockClear();
    setWalkthrough(false, null);
  });

  it('caps the picker to one metric during a walkthrough run', () => {
    // The guided KPI is a demonstration — any metric teaches the same thing — so the step is a
    // click, not a decision. The cap is what enforces that: nothing else is in the list.
    setWalkthrough(true, 'kpi_metric');

    renderStep();

    expect(passedMaxItems()).toBe(1);
  });

  it('leaves the library whole for anyone not in a walkthrough', () => {
    renderStep();

    expect(passedMaxItems()).toBeUndefined();
  });

  it('keeps the cap once the walkthrough has moved past the metric stage', () => {
    // Regression: the cap used to be scoped to `stage === 'kpi_metric'`, and that stage advances
    // on the very click that opens the dropdown — so the list repopulated with the full library
    // under the user's own click. The cap belongs to the run, not to one stage of it.
    setWalkthrough(true, 'kpi_step1_continue');

    renderStep();

    expect(passedMaxItems()).toBe(1);
  });
});
