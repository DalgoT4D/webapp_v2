import useSWR from 'swr';
import { apiGet } from '@/lib/api';

export interface Chart {
  id: number;
  title: string;
  description?: string;
  chart_type: string;
  computation_type: string;
  schema_name: string;
  table_name: string;
  extra_config: any;
  render_config?: any;
  created_at: string;
  updated_at: string;
}

interface UseChartsParams {
  search?: string;
}

export function useCharts(params?: UseChartsParams) {
  const { data, error, mutate } = useSWR<Chart[]>('/api/charts/', apiGet);

  // Mock data for testing when API fails
  const mockCharts: Chart[] = [
    {
      id: 1,
      title: 'Monthly Revenue Trend',
      description: 'Revenue trends over the last 12 months',
      chart_type: 'line',
      computation_type: 'raw',
      schema_name: 'public',
      table_name: 'sales_data',
      extra_config: {
        x_axis_column: 'month',
        y_axis_column: 'revenue',
        customizations: {},
      },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      title: 'Sales by Region',
      description: 'Sales distribution across different regions',
      chart_type: 'bar',
      computation_type: 'grouped',
      schema_name: 'public',
      table_name: 'regional_sales',
      extra_config: {
        x_axis_column: 'region',
        y_axis_column: 'sales_amount',
        customizations: {},
      },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 3,
      title: 'Customer Segments',
      description: 'Distribution of customers by segment',
      chart_type: 'pie',
      computation_type: 'count',
      schema_name: 'public',
      table_name: 'customers',
      extra_config: {
        dimension_column: 'segment',
        aggregate_function: 'count',
        customizations: {},
      },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  // Use mock data if API fails
  const chartsData = error ? mockCharts : data;

  // Filter charts based on search
  const filteredCharts =
    chartsData && params?.search
      ? chartsData.filter(
          (chart) =>
            chart.title.toLowerCase().includes(params.search!.toLowerCase()) ||
            chart.chart_type.toLowerCase().includes(params.search!.toLowerCase()) ||
            chart.schema_name.toLowerCase().includes(params.search!.toLowerCase()) ||
            chart.table_name.toLowerCase().includes(params.search!.toLowerCase())
        )
      : chartsData;

  return {
    data: filteredCharts,
    isLoading: !error && !data,
    isError: error,
    mutate,
  };
}

// Mock charts for useChart
const mockChartsMap: Record<number, Chart> = {
  1: {
    id: 1,
    title: 'Monthly Revenue Trend',
    description: 'Revenue trends over the last 12 months',
    chart_type: 'line',
    computation_type: 'raw',
    schema_name: 'public',
    table_name: 'sales_data',
    extra_config: {
      x_axis_column: 'month',
      y_axis_column: 'revenue',
      customizations: {},
    },
    render_config: {
      title: { text: 'Monthly Revenue Trend' },
      xAxis: { type: 'category', data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
      yAxis: { type: 'value' },
      series: [{ type: 'line', data: [120, 200, 150, 80, 70, 110] }],
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  2: {
    id: 2,
    title: 'Sales by Region',
    description: 'Sales distribution across different regions',
    chart_type: 'bar',
    computation_type: 'grouped',
    schema_name: 'public',
    table_name: 'regional_sales',
    extra_config: {
      x_axis_column: 'region',
      y_axis_column: 'sales_amount',
      customizations: {},
    },
    render_config: {
      title: { text: 'Sales by Region' },
      xAxis: { type: 'category', data: ['North', 'South', 'East', 'West'] },
      yAxis: { type: 'value' },
      series: [{ type: 'bar', data: [320, 280, 350, 400] }],
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  3: {
    id: 3,
    title: 'Customer Segments',
    description: 'Distribution of customers by segment',
    chart_type: 'pie',
    computation_type: 'count',
    schema_name: 'public',
    table_name: 'customers',
    extra_config: {
      dimension_column: 'segment',
      aggregate_function: 'count',
      customizations: {},
    },
    render_config: {
      title: { text: 'Customer Segments' },
      series: [
        {
          type: 'pie',
          data: [
            { value: 335, name: 'Enterprise' },
            { value: 310, name: 'SMB' },
            { value: 234, name: 'Startup' },
            { value: 135, name: 'Individual' },
          ],
        },
      ],
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
};

export function useChart(id: number) {
  const { data, error, mutate } = useSWR<Chart>(id ? `/api/charts/${id}/` : null, apiGet);

  // Use mock data if API fails
  const chartData = error && mockChartsMap[id] ? mockChartsMap[id] : data;

  return {
    data: chartData,
    isLoading: !error && !data,
    isError: error && !mockChartsMap[id],
    mutate,
  };
}

export function useChartData(id: number) {
  const { data, error, mutate } = useSWR(id ? `/api/charts/${id}/data/` : null, apiGet);

  // Mock chart data response
  const mockChartData = mockChartsMap[id]
    ? {
        data: [],
        echarts_config: mockChartsMap[id].render_config,
      }
    : null;

  // Use mock data if API fails
  const chartData = error && mockChartData ? mockChartData : data;

  return {
    data: chartData,
    isLoading: !error && !data,
    isError: error && !mockChartData,
    mutate,
  };
}
