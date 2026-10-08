import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { Table } from '@/components/ui/table';
import { ChartListTableHeader } from '@/components/charts/list/ChartListTableHeader';
import { useChartListFilters } from '@/components/charts/list/useChartListFilters';

describe('useChartListFilters', () => {
  it('counts one per active column and clears all', () => {
    const { result } = renderHook(() => useChartListFilters());
    expect(result.current.activeFilterCount).toBe(0);
    act(() => result.current.setNameFilters({ text: 'enrol', showFavorites: true }));
    act(() => result.current.setDataSourceFilters(['public.students']));
    act(() => result.current.setDateFilters((prev) => ({ ...prev, range: 'week' })));
    expect(result.current.activeFilters).toEqual({
      name: true,
      dataSource: true,
      chartType: false,
      date: true,
    });
    expect(result.current.activeFilterCount).toBe(3);
    act(() => result.current.clearAllFilters());
    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.values.nameFilters).toEqual({ text: '', showFavorites: false });
  });

  it('keeps `values` referentially stable while nothing changes', () => {
    const { result, rerender } = renderHook(() => useChartListFilters());
    const first = result.current.values;
    rerender();
    expect(result.current.values).toBe(first);
  });
});

function HeaderHarness({ onSort }: { onSort: jest.Mock }) {
  const filters = useChartListFilters();
  return (
    <Table>
      <ChartListTableHeader
        sortBy="updated_at"
        sortOrder="desc"
        onSort={onSort}
        filters={filters}
        uniqueDataSources={['public.students', 'staging.attendance']}
        uniqueChartTypes={['bar', 'line']}
      />
    </Table>
  );
}

describe('ChartListTableHeader', () => {
  it('renders the six columns with their sort testids', () => {
    const onSort = jest.fn();
    render(<HeaderHarness onSort={onSort} />);
    ['Name', 'Data Source', 'Type', 'Created by', 'Last Modified', 'Actions'].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument()
    );
    fireEvent.click(screen.getByTestId('chart-list-sort-data-source'));
    expect(onSort).toHaveBeenCalledWith('data_source');
    fireEvent.click(screen.getByTestId('chart-list-sort-updated-at'));
    expect(onSort).toHaveBeenCalledWith('updated_at');
  });

  it('data source popover: search narrows the options, no match shows the empty text, ticking marks the filter active', () => {
    render(<HeaderHarness onSort={jest.fn()} />);
    fireEvent.click(screen.getByTestId('chart-list-filter-source-trigger'));
    expect(screen.getByText('Filter by Data Source')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('chart-list-filter-source-search'), {
      target: { value: 'STAG' },
    });
    expect(screen.queryByTestId('chart-list-filter-source-option-public.students')).toBeNull();
    fireEvent.click(screen.getByTestId('chart-list-filter-source-option-staging.attendance'));
    expect(
      screen.getByTestId('chart-list-filter-source-trigger').querySelector('.bg-teal-600')
    ).not.toBeNull();
    fireEvent.change(screen.getByTestId('chart-list-filter-source-search'), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('No data sources found')).toBeInTheDocument();
  });
});
