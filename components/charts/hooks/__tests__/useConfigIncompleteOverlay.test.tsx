import { act, renderHook } from '@testing-library/react';
import type { MouseEvent } from 'react';
import type { ChartBuilderFormData } from '@/types/charts';
import { useConfigIncompleteOverlay } from '@/components/charts/hooks/useConfigIncompleteOverlay';

const incompleteBar: ChartBuilderFormData = {
  title: 'Sales',
  chart_type: 'bar',
  computation_type: 'aggregated',
  schema_name: 'public',
  table_name: 'sales',
  customizations: {},
};

const completeBar: ChartBuilderFormData = {
  ...incompleteBar,
  dimension_column: 'region',
  aggregate_column: 'amount',
  aggregate_function: 'sum',
};

function clickEvent() {
  return { preventDefault: jest.fn(), stopPropagation: jest.fn() } as unknown as MouseEvent;
}

type Props = { config: ChartBuilderFormData; chartDataLoading: boolean };

function renderOverlay(initialProps: Props) {
  return renderHook(
    ({ config, chartDataLoading }: Props) =>
      useConfigIncompleteOverlay({ config, chartDataLoading, chartData: null }),
    { initialProps }
  );
}

describe('useConfigIncompleteOverlay', () => {
  it('shows for an incomplete chart once the preview is not loading', () => {
    const { result, rerender } = renderOverlay({ config: incompleteBar, chartDataLoading: true });
    expect(result.current.isVisible).toBe(false);
    rerender({ config: incompleteBar, chartDataLoading: false });
    expect(result.current.isVisible).toBe(true);
  });

  it('stays hidden for a complete chart, a map and a table', () => {
    for (const config of [
      completeBar,
      { ...incompleteBar, chart_type: 'map' as const },
      { ...incompleteBar, chart_type: 'table' as const },
    ]) {
      const { result } = renderOverlay({ config, chartDataLoading: false });
      expect(result.current.isVisible).toBe(false);
    }
  });

  it('hides when the config becomes complete', () => {
    const { result, rerender } = renderOverlay({ config: incompleteBar, chartDataLoading: false });
    expect(result.current.isVisible).toBe(true);
    rerender({ config: completeBar, chartDataLoading: false });
    expect(result.current.isVisible).toBe(false);
  });

  it('dismiss hides it until a watched config field changes', () => {
    const { result, rerender } = renderOverlay({ config: incompleteBar, chartDataLoading: false });
    const event = clickEvent();
    act(() => result.current.dismiss(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(result.current.isVisible).toBe(false);

    // An unwatched field (title) does not re-arm it.
    rerender({ config: { ...incompleteBar, title: 'Other' }, chartDataLoading: false });
    expect(result.current.isVisible).toBe(false);

    // A watched field (dimension_column) re-arms it while still incomplete.
    rerender({
      config: { ...incompleteBar, title: 'Other', dimension_column: 'region' },
      chartDataLoading: false,
    });
    expect(result.current.isVisible).toBe(true);
  });
});
