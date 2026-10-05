import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useMapDrillPath } from '@/components/dashboard/widgets/chart/useMapDrillPath';
import { useChartWidgetTable } from '@/components/dashboard/widgets/chart/useChartWidgetTable';
import { MapDrillBreadcrumb } from '@/components/dashboard/widgets/chart/MapDrillBreadcrumb';
import { TableDrillBreadcrumb } from '@/components/dashboard/widgets/chart/TableDrillBreadcrumb';

const level = (name: string, i: number) => ({
  level: i + 1,
  name,
  geographic_column: 'c',
  geojson_id: 0,
  parent_selections: [] as Array<{ column: string; value: string }>,
});

describe('useMapDrillPath', () => {
  it('drill up keeps levels up to the target; home and -1 clear', () => {
    const { result } = renderHook(() => useMapDrillPath());
    act(() => result.current.setDrillDownPath([level('A', 0), level('B', 1), level('C', 2)]));
    act(() => result.current.handleDrillUp(0));
    expect(result.current.drillDownPath.map((l) => l.name)).toEqual(['A']);
    act(() => result.current.handleDrillUp(-1));
    expect(result.current.drillDownPath).toEqual([]);
    act(() => result.current.setDrillDownPath([level('A', 0)]));
    act(() => result.current.handleDrillHome());
    expect(result.current.drillDownPath).toEqual([]);
  });
});

describe('useChartWidgetTable', () => {
  const table = {
    chart_type: 'table',
    extra_config: {
      dimensions: [
        { column: 'state', enable_drill_down: true },
        { column: 'district', enable_drill_down: true },
        { column: 'block', enable_drill_down: true },
      ],
    },
  };

  it('drilling into a row moves one level down and back to page 1; Back goes up', () => {
    const { result } = renderHook(() => useChartWidgetTable(table));
    act(() => result.current.setTablePage(3));
    act(() => result.current.handleTableRowClick({ state: 'Assam' }, 'state'));
    expect(result.current.tableDrillDownState).toEqual({
      currentLevel: 0,
      appliedFilters: { state: 'Assam' },
    });
    expect(result.current.tablePage).toBe(1);
    expect(result.current.currentDimensionColumn).toBe('district');
    act(() => result.current.setTablePage(2));
    act(() => result.current.handleTableDrillUp());
    expect(result.current.tableDrillDownState).toBeNull();
    expect(result.current.tablePage).toBe(1);
  });

  it('page size change resets to page 1; non-table charts ignore clicks', () => {
    const { result } = renderHook(() =>
      useChartWidgetTable({ chart_type: 'bar', extra_config: {} })
    );
    expect(result.current.tablePageSize).toBe(20);
    act(() => result.current.setTablePage(4));
    act(() => result.current.handleTablePageSizeChange(50));
    expect(result.current.tablePageSize).toBe(50);
    expect(result.current.tablePage).toBe(1);
    act(() => result.current.handleTableRowClick({ state: 'Assam' }, 'state'));
    expect(result.current.tableDrillDownState).toBeNull();
  });
});

describe('breadcrumbs', () => {
  it('map: Home and one crumb per level; a crumb drills up to the level before it', () => {
    const onHome = jest.fn();
    const onDrillUp = jest.fn();
    render(
      <MapDrillBreadcrumb
        chartId={7}
        drillDownPath={[level('A', 0), level('B', 1)]}
        onHome={onHome}
        onDrillUp={onDrillUp}
      />
    );
    fireEvent.click(screen.getByTestId('dashboard-chart-map-home-7'));
    fireEvent.click(screen.getByTestId('dashboard-chart-map-crumb-7-1'));
    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onDrillUp).toHaveBeenCalledWith(0);
    expect(screen.getByTestId('dashboard-chart-map-crumb-7-0')).toHaveTextContent('A');
  });

  it('table: Back and "col: value → col: value"', () => {
    const onBack = jest.fn();
    render(
      <TableDrillBreadcrumb
        chartId={7}
        appliedFilters={{ state: 'Assam', district: 'Kamrup' }}
        onBack={onBack}
      />
    );
    expect(screen.getByText('state: Assam → district: Kamrup')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('dashboard-chart-table-back-7'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
