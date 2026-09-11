import type React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KPIForm } from '../kpi-form';
import { InsightWalkthroughCoachmark } from '@/components/onboarding/insight-walkthrough-coachmark';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { createKPI } from '@/hooks/api/useKPIs';

const mockMutate = jest.fn();
const mockMetrics = [{ id: 1, name: 'Reach', schema_name: 'public', table_name: 'reach' }];
jest.mock('next/navigation', () => ({ usePathname: () => '/kpis' }));
jest.mock('@/hooks/api/useMetrics', () => ({
  useMetrics: () => ({ data: mockMetrics, mutate: mockMutate }),
}));
jest.mock('@/hooks/api/useWarehouse', () => ({
  useTableColumns: (): { data: never[] } => ({ data: [] }),
}));
jest.mock('@/hooks/api/useKPIs', () => ({
  useProgramTags: (): { tags: string[] } => ({ tags: [] }),
  createKPI: jest.fn(),
  updateKPI: jest.fn(),
}));
// The metric API/picker is unrelated to retaining wizard state. Keep the real
// react-hook-form instance, both editable form steps, Radix controls and driver.js.
jest.mock('../KpiMetricStep', () => {
  const React = jest.requireActual('react');
  return {
    KpiMetricStep: React.forwardRef(function MetricStep(
      { onMetricSelected }: { onMetricSelected: (id: number, name: string) => void },
      ref: React.Ref<unknown>
    ) {
      React.useImperativeHandle(ref, () => ({ handleContinue: async () => true }));
      return (
        <div data-testid="kpi-form-metric-field">
          <button type="button" onClick={() => onMetricSelected(1, 'Reach')}>
            Choose Reach
          </button>
        </div>
      );
    }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  window.history.replaceState({}, '', '/kpis');
  window.scrollBy = jest.fn();
  // next/jest stubs CSS imports. Restore tour.css's pointer-events rule so the
  // portalled coachmark remains clickable over Radix's modal body lock.
  const style = document.createElement('style');
  style.textContent = '.dalgo-tour { pointer-events: auto; }';
  document.head.appendChild(style);
  useInsightWalkthroughStore.setState({
    active: true,
    orgSlug: 'org-a',
    flow: 'insights',
    path: 'sample',
    stage: 'kpi_metric',
    reviewReturnStage: null,
    suppressCoachmark: false,
    trackedConnectionId: null,
  });
});

function targetInput() {
  return within(screen.getByTestId('kpi-form-target-field')).getByRole('spinbutton');
}
function popoverButton(name: string) {
  return within(document.querySelector('.driver-popover') as HTMLElement).getByRole('button', {
    name,
  });
}

it('keeps entered KPI values through every earlier wizard step and saves exactly once', async () => {
  const user = userEvent.setup();
  const onSuccess = jest.fn();
  render(
    <>
      <KPIForm open onOpenChange={jest.fn()} onSuccess={onSuccess} />
      <InsightWalkthroughCoachmark />
    </>
  );
  await user.click(await screen.findByRole('button', { name: 'Choose Reach' }));
  await user.click(screen.getByTestId('kpi-form-step1-continue-btn'));
  await screen.findByTestId('kpi-form-target-field');
  await user.clear(screen.getByLabelText(/Name this KPI/));
  await user.type(screen.getByLabelText(/Name this KPI/), 'My retained KPI');
  await user.clear(targetInput());
  await user.type(targetInput(), '54321');
  await user.click(popoverButton('Got it'));
  await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_direction'));
  await user.click(popoverButton('Got it'));
  // No date columns: the conditional time-column hint must be skipped.
  await waitFor(() => expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_continue'), {
    timeout: 3000,
  });
  await user.click(screen.getByTestId('kpi-form-continue-btn'));
  await screen.findByTestId('kpi-form-rag-field');
  const bands = within(screen.getByTestId('kpi-form-rag-field')).getAllByRole('spinbutton');
  fireEvent.change(bands[0], { target: { value: '90' } });
  fireEvent.change(bands[1], { target: { value: '60' } });
  // Park at Create after filling the wizard. Back/Next only reviews hints, never submits.
  act(() => useInsightWalkthroughStore.getState().advanceTo('kpi_submit'));
  const form = screen.getByTestId('kpi-form');
  for (
    let count = 0;
    count < 12 && useInsightWalkthroughStore.getState().stage !== 'kpi_metric';
    count++
  ) {
    await waitFor(() => expect(popoverButton('Back')).toBeEnabled());
    await user.click(popoverButton('Back'));
  }
  expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_metric');
  expect(screen.getByTestId('kpi-form')).toBe(form);
  expect(createKPI).not.toHaveBeenCalled();
  for (
    let count = 0;
    count < 12 && useInsightWalkthroughStore.getState().stage !== 'kpi_submit';
    count++
  ) {
    await waitFor(() => expect(popoverButton('Next')).toBeEnabled());
    await user.click(popoverButton('Next'));
    if (useInsightWalkthroughStore.getState().stage === 'kpi_target') {
      expect(await screen.findByLabelText(/Name this KPI/)).toHaveValue('My retained KPI');
      expect(targetInput()).toHaveValue(54321);
    }
  }
  expect(useInsightWalkthroughStore.getState().stage).toBe('kpi_submit');
  const restoredBands = within(screen.getByTestId('kpi-form-rag-field')).getAllByRole('spinbutton');
  expect(restoredBands[0]).toHaveValue(90);
  expect(restoredBands[1]).toHaveValue(60);
  expect(createKPI).not.toHaveBeenCalled();
  jest.mocked(createKPI).mockResolvedValueOnce({ id: 99 } as Awaited<ReturnType<typeof createKPI>>);
  await user.click(screen.getByTestId('kpi-form-submit-btn'));
  await waitFor(() => expect(createKPI).toHaveBeenCalledTimes(1));
  expect(createKPI).toHaveBeenCalledWith(
    expect.objectContaining({
      metric_id: 1,
      name: 'My retained KPI',
      target_value: 54321,
      green_threshold_pct: 90,
      amber_threshold_pct: 60,
      program_tags: ['Education'],
    })
  );
  expect(onSuccess).toHaveBeenCalledWith(99);
}, 15000);
