import type React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KPIForm } from '../kpi-form';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import { createKPI } from '@/hooks/api/useKPIs';
import {
  WALKTHROUGH_DEFAULT_KPI_TYPE,
  WALKTHROUGH_PREFERRED_TIME_COLUMN,
} from '@/components/onboarding/insight-walkthrough-constants';

const mockMetrics = [{ id: 1, name: 'Reach', schema_name: 'public', table_name: 'reach' }];
let mockColumns: { name: string; data_type: string }[] = [];
// "date" deliberately NOT first: the walkthrough must pick the column of that name (the sample
// dataset's), not merely the first date column it finds.
const DEFAULT_COLUMNS = [
  { name: 'created_at', data_type: 'timestamp' },
  { name: 'district', data_type: 'text' },
  { name: 'date', data_type: 'date' },
];

jest.mock('next/navigation', () => ({ usePathname: () => '/kpis' }));
// Identity matters: the form's reset-on-open effect depends on `mutate`, so a fresh function
// per render would re-reset the form forever.
const mockMutate = jest.fn();
jest.mock('@/hooks/api/useMetrics', () => ({
  useMetrics: () => ({ data: mockMetrics, mutate: mockMutate }),
}));
jest.mock('@/hooks/api/useWarehouse', () => ({
  useTableColumns: () => ({ data: mockColumns }),
}));
jest.mock('@/hooks/api/useKPIs', () => ({
  useProgramTags: (): { tags: string[] } => ({ tags: [] }),
  createKPI: jest.fn(),
  updateKPI: jest.fn(),
}));
// The metric picker is unrelated to what the form prefills — keep the real form, its Radix
// controls and react-hook-form instance.
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
  mockColumns = DEFAULT_COLUMNS;
  useInsightWalkthroughStore.setState({
    active: true,
    orgSlug: 'org-a',
    flow: 'insights',
    path: 'sample',
    stage: 'kpi_metric',
    reviewReturnStage: null,
    suppressCoachmark: true,
    trackedConnectionId: null,
  });
});

async function fillToStep3(user: ReturnType<typeof userEvent.setup>) {
  render(<KPIForm open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);
  await user.click(await screen.findByRole('button', { name: 'Choose Reach' }));
  await user.click(screen.getByTestId('kpi-form-step1-continue-btn'));
  await screen.findByTestId('kpi-form-target-field');
  await user.click(screen.getByTestId('kpi-form-continue-btn'));
  await screen.findByTestId('kpi-form-rag-field');
}

it('starts a walkthrough KPI on the date column and the Impact type', async () => {
  const user = userEvent.setup();
  await fillToStep3(user);

  jest.mocked(createKPI).mockResolvedValueOnce({ id: 7 } as Awaited<ReturnType<typeof createKPI>>);
  await user.click(screen.getByTestId('kpi-form-submit-btn'));

  await waitFor(() => expect(createKPI).toHaveBeenCalledTimes(1));
  expect(createKPI).toHaveBeenCalledWith(
    expect.objectContaining({
      time_dimension_column: WALKTHROUGH_PREFERRED_TIME_COLUMN,
      metric_type_tag: WALKTHROUGH_DEFAULT_KPI_TYPE,
    })
  );
});

it('leaves the time column for the user to answer outside a walkthrough', async () => {
  useInsightWalkthroughStore.setState({ active: false, stage: null });
  const user = userEvent.setup();
  render(<KPIForm open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);
  await user.click(await screen.findByRole('button', { name: 'Choose Reach' }));
  await user.click(screen.getByTestId('kpi-form-step1-continue-btn'));

  const timeColumn = within(await screen.findByTestId('kpi-form-time-column-field')).getByRole(
    'combobox'
  );
  expect(timeColumn).not.toHaveTextContent('date');
});

it('leaves the KPI type unchosen outside a walkthrough', async () => {
  // No date columns, so the Time Column field never renders and step 2 passes validation
  // without one — the shortest honest route to step 3's type buttons.
  mockColumns = [{ name: 'district', data_type: 'text' }];
  useInsightWalkthroughStore.setState({ active: false, stage: null });
  const user = userEvent.setup();
  render(<KPIForm open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);
  await user.click(await screen.findByRole('button', { name: 'Choose Reach' }));
  await user.click(screen.getByTestId('kpi-form-step1-continue-btn'));
  await user.type(
    within(await screen.findByTestId('kpi-form-target-field')).getByRole('spinbutton'),
    '100'
  );
  await user.click(screen.getByTestId('kpi-form-continue-btn'));

  const typeButtons = within(await screen.findByTestId('kpi-form-type-field')).getAllByRole(
    'button'
  );
  // Selected buttons carry the filled style — see KpiThresholdsStep.
  expect(typeButtons.some((b) => b.className.includes('text-white'))).toBe(false);
});
