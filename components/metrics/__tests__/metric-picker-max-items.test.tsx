import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetricPicker } from '../MetricPicker';
import type { Metric } from '@/types/metrics';

const mockUseMetrics = jest.fn();
jest.mock('@/hooks/api/useMetrics', () => ({
  useMetrics: (...args: unknown[]) => mockUseMetrics(...args),
}));

function metric(id: number, name: string): Metric {
  return {
    id,
    name,
    description: '',
    schema_name: 'intermediate',
    table_name: 'mart_coverage_by_district',
    column_name: 'pct_rural',
    aggregation: 'avg',
    column_expression: null,
  } as Metric;
}

const METRICS = [
  metric(1, 'Avg Rural Coverage %'),
  metric(2, 'Private Schools'),
  metric(3, 'Girls-Only Schools'),
];

/** Opens the combobox, which renders its options into a portal. */
async function openList(): Promise<void> {
  await userEvent.click(screen.getByRole('combobox'));
}

describe('MetricPicker maxItems', () => {
  beforeEach(() => {
    mockUseMetrics.mockReturnValue({ data: METRICS, isLoading: false });
  });

  it('offers the whole library by default', async () => {
    render(<MetricPicker value={null} onChange={jest.fn()} />);

    await openList();

    expect(screen.getAllByRole('option')).toHaveLength(METRICS.length);
  });

  it('offers only the first metric when capped to one', async () => {
    // The onboarding walkthrough's cap: the guided KPI is a demonstration, so the step needs a
    // click rather than a decision. Enforced by there being nothing else in the list — not by
    // blocking clicks on rows the user can still see.
    render(<MetricPicker value={null} onChange={jest.fn()} maxItems={1} />);

    await openList();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Avg Rural Coverage %');
    expect(screen.queryByText('Private Schools')).not.toBeInTheDocument();
  });

  it('leaves the pinned metric standing when the cap is one', async () => {
    // The walkthrough names the metric it wants the guided KPI built on (see
    // WALKTHROUGH_METRIC_NAME) — capping alone left the step on whatever the API returned first.
    render(
      <MetricPicker
        value={null}
        onChange={jest.fn()}
        maxItems={1}
        pinMetricName="Private Schools"
      />
    );

    await openList();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Private Schools');
  });

  it('falls back to the first metric when the pinned name is absent', async () => {
    // An org with its own metrics library, or sample data that was never seeded.
    render(
      <MetricPicker value={null} onChange={jest.fn()} maxItems={1} pinMetricName="total_students" />
    );

    await openList();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Avg Rural Coverage %');
  });

  it('keeps the whole library when a pin is set without a cap', async () => {
    render(<MetricPicker value={null} onChange={jest.fn()} pinMetricName="Girls-Only Schools" />);

    await openList();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(METRICS.length);
    // Pinned to the front, so a capped render would keep it — and nothing is dropped here.
    expect(options[0]).toHaveTextContent('Girls-Only Schools');
  });

  it('still selects normally through the cap', async () => {
    const onChange = jest.fn();
    render(<MetricPicker value={null} onChange={onChange} maxItems={1} />);

    await openList();
    await userEvent.click(screen.getByRole('option'));

    expect(onChange).toHaveBeenCalledWith(METRICS[0].id);
  });
});
