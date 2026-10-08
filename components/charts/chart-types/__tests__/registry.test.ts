import { BarChart2, Grid3X3, Hash, LineChart, MapPin, PieChart, Table } from 'lucide-react';
import {
  BUILDER_SELECTOR_ORDER,
  CHART_TYPE_INFO,
  NEW_CHART_CARD_ORDER,
  getChartListIcon,
  getChartTypeColors,
} from '@/components/charts/chart-types/registry';

describe('chart-type registry', () => {
  it('has one entry per chart type', () => {
    expect(Object.keys(CHART_TYPE_INFO).sort()).toEqual(
      ['bar', 'line', 'map', 'number', 'pie', 'pivot_table', 'table'].sort()
    );
  });

  it('keeps the builder switcher order and labels', () => {
    expect(BUILDER_SELECTOR_ORDER).toEqual([
      'bar',
      'line',
      'pie',
      'number',
      'map',
      'table',
      'pivot_table',
    ]);
    expect(CHART_TYPE_INFO.number.selector).toEqual({
      label: 'Big Number',
      description: 'Display a single key metric prominently',
    });
  });

  it('keeps the /charts/new card order and labels', () => {
    expect(NEW_CHART_CARD_ORDER).toEqual([
      'bar',
      'pie',
      'line',
      'number',
      'map',
      'table',
      'pivot_table',
    ]);
    expect(CHART_TYPE_INFO.number.newChartCard).toEqual({
      label: 'Number',
      description: 'Display key metrics and KPIs',
      textClassName: 'text-purple-600',
      bgClassName: 'bg-purple-50',
    });
  });

  it('uses the same icon per type in the switcher and the new-chart cards', () => {
    expect(CHART_TYPE_INFO.bar.icon).toBe(BarChart2);
    expect(CHART_TYPE_INFO.line.icon).toBe(LineChart);
    expect(CHART_TYPE_INFO.pie.icon).toBe(PieChart);
    expect(CHART_TYPE_INFO.number.icon).toBe(Hash);
    expect(CHART_TYPE_INFO.map.icon).toBe(MapPin);
    expect(CHART_TYPE_INFO.table.icon).toBe(Table);
    expect(CHART_TYPE_INFO.pivot_table.icon).toBe(Grid3X3);
  });

  it('shows the bar icon for pivot tables in the chart list (pinned bug)', () => {
    expect(getChartListIcon('pivot_table')).toBe(BarChart2);
    expect(getChartListIcon('table')).toBe(Table);
  });

  it('unknown type falls back to the bar icon and bar colors', () => {
    expect(getChartListIcon('sankey')).toBe(BarChart2);
    expect(getChartTypeColors('sankey')).toEqual(CHART_TYPE_INFO.bar.colors);
  });

  it('keeps the exact colors', () => {
    expect(getChartTypeColors('pivot_table')).toEqual({
      color: '#0EA5E9',
      bgColor: '#0EA5E91A',
      className: 'text-[#0EA5E9]',
      bgClassName: 'bg-[#0EA5E9]/10',
    });
  });
});
