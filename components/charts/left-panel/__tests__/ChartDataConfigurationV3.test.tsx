/**
 * Comprehensive tests for ChartDataConfigurationV3 component
 * Ultra-consolidated version with minimal parameterized tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartDataConfigurationV3 } from '../ChartDataConfigurationV3';
import * as useChartHooks from '@/hooks/api/useChart';
import * as chartAutoPrefill from '@/lib/chartAutoPrefill';

jest.mock('@/hooks/api/useChart');
jest.mock('@/lib/chartAutoPrefill', () => ({
  generateAutoPrefilledConfig: jest.fn(),
}));

jest.mock('../ChartTypeSelector', () => ({
  ChartTypeSelector: ({ value, onChange, disabled }: any) => (
    <div data-testid="chart-type-selector">
      <span data-testid="current-chart-type">{value}</span>
      {['bar', 'line', 'pie', 'number', 'map', 'table'].map((type) => (
        <button
          key={type}
          data-testid={`change-to-${type}`}
          onClick={() => onChange(type)}
          disabled={disabled}
        >
          {type}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('../DatasetSelector', () => ({
  DatasetSelector: ({ schema_name, table_name, onDatasetChange, disabled }: any) => (
    <div data-testid="dataset-selector">
      <span data-testid="current-dataset">
        {schema_name}/{table_name}
      </span>
      <button
        data-testid="change-dataset"
        onClick={() => onDatasetChange('new_schema', 'new_table')}
        disabled={disabled}
      >
        Change Dataset
      </button>
    </div>
  ),
}));

jest.mock('../MetricsSelector', () => ({
  MetricsSelector: ({ metrics, onChange, chartType, maxMetrics, disabled }: any) => (
    <div data-testid="metrics-selector">
      <span data-testid="metrics-count">{metrics?.length || 0}</span>
      <span data-testid="max-metrics">{maxMetrics || 'unlimited'}</span>
      <button
        data-testid="add-metric"
        onClick={() =>
          onChange([...(metrics || []), { column: 'amount', aggregation: 'sum', alias: 'Total' }])
        }
        disabled={disabled}
      >
        Add Metric
      </button>
    </div>
  ),
}));

jest.mock('../TimeGrainSelector', () => ({
  TimeGrainSelector: ({ value, onChange, disabled }: any) => (
    <div data-testid="time-grain-selector">
      <span data-testid="current-time-grain">{value || 'none'}</span>
      <button data-testid="set-time-grain-day" onClick={() => onChange('day')} disabled={disabled}>
        Day
      </button>
    </div>
  ),
}));

// SimpleTableConfiguration was removed - no longer needed

describe('ChartDataConfigurationV3', () => {
  const mockOnChange = jest.fn();

  const baseFormData = {
    title: 'Test Chart',
    chart_type: 'bar' as const,
    schema_name: 'public',
    table_name: 'sales',
    computation_type: 'aggregated' as const,
  };

  const mockColumns = [
    { column_name: 'category', name: 'category', data_type: 'varchar' },
    { column_name: 'amount', name: 'amount', data_type: 'numeric' },
    { column_name: 'created_at', name: 'created_at', data_type: 'timestamp' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useChartHooks.useColumns as jest.Mock).mockReturnValue({
      data: mockColumns,
      isLoading: false,
      error: null,
    });
    (useChartHooks.useColumnValues as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    (chartAutoPrefill.generateAutoPrefilledConfig as jest.Mock).mockReturnValue({});
  });

  describe('Basic Rendering', () => {
    it('should render all main components', () => {
      render(<ChartDataConfigurationV3 formData={baseFormData} onChange={mockOnChange} />);
      expect(screen.getByTestId('chart-type-selector')).toBeInTheDocument();
      expect(screen.getByTestId('dataset-selector')).toBeInTheDocument();
      expect(screen.getByText('Data Source')).toBeInTheDocument();
    });

    it('should show correct labels for different chart types', () => {
      const { rerender } = render(
        <ChartDataConfigurationV3 formData={baseFormData} onChange={mockOnChange} />
      );
      expect(screen.getByText('X Axis')).toBeInTheDocument();

      rerender(
        <ChartDataConfigurationV3
          formData={{ ...baseFormData, chart_type: 'pie' }}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText('Dimension')).toBeInTheDocument();

      rerender(
        <ChartDataConfigurationV3
          formData={{ ...baseFormData, chart_type: 'number' }}
          onChange={mockOnChange}
        />
      );
      expect(screen.queryByText('X Axis')).not.toBeInTheDocument();
    });

    it('should control extra dimension visibility by chart type', () => {
      const { rerender } = render(
        <ChartDataConfigurationV3 formData={baseFormData} onChange={mockOnChange} />
      );
      expect(screen.getByText('Extra Dimension')).toBeInTheDocument();

      rerender(
        <ChartDataConfigurationV3
          formData={{ ...baseFormData, chart_type: 'number' }}
          onChange={mockOnChange}
        />
      );
      expect(screen.queryByText('Extra Dimension')).not.toBeInTheDocument();
    });

    it('should set correct maxMetrics', () => {
      const { rerender } = render(
        <ChartDataConfigurationV3
          formData={{ ...baseFormData, chart_type: 'pie' }}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByTestId('max-metrics')).toHaveTextContent('1');

      rerender(<ChartDataConfigurationV3 formData={baseFormData} onChange={mockOnChange} />);
      expect(screen.getByTestId('max-metrics')).toHaveTextContent('unlimited');
    });
  });

  describe('Time Grain', () => {
    it('should show time grain for time columns on bar/line charts', () => {
      const { rerender } = render(
        <ChartDataConfigurationV3
          formData={{ ...baseFormData, dimension_column: 'created_at' }}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByTestId('time-grain-selector')).toBeInTheDocument();

      rerender(
        <ChartDataConfigurationV3
          formData={{ ...baseFormData, dimension_column: 'category' }}
          onChange={mockOnChange}
        />
      );
      expect(screen.queryByTestId('time-grain-selector')).not.toBeInTheDocument();
    });

    it('should handle time grain change', async () => {
      const user = userEvent.setup();
      render(
        <ChartDataConfigurationV3
          formData={{ ...baseFormData, dimension_column: 'created_at' }}
          onChange={mockOnChange}
        />
      );
      await user.click(screen.getByTestId('set-time-grain-day'));
      expect(mockOnChange).toHaveBeenCalledWith({ time_grain: 'day' });
    });
  });

  describe('Dataset and Chart Type Changes', () => {
    it('should reset form when dataset changes', async () => {
      const user = userEvent.setup();
      const formData = {
        ...baseFormData,
        dimension_column: 'category',
        metrics: [{ column: 'amount', aggregation: 'sum' }],
        filters: [{ column: 'status', operator: 'equals' as const, value: 'active' }],
      };

      render(<ChartDataConfigurationV3 formData={formData} onChange={mockOnChange} />);
      await user.click(screen.getByTestId('change-dataset'));

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          schema_name: 'new_schema',
          table_name: 'new_table',
          dimension_column: undefined,
          metrics: [],
          filters: [],
        })
      );
    });

    it('should adjust config when switching chart types', async () => {
      const user = userEvent.setup();
      render(<ChartDataConfigurationV3 formData={baseFormData} onChange={mockOnChange} />);

      await user.click(screen.getByTestId('change-to-pie'));
      expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ chart_type: 'pie' }));
    });
  });

  describe('Filters', () => {
    it('should add and remove filters', async () => {
      const user = userEvent.setup();
      render(<ChartDataConfigurationV3 formData={baseFormData} onChange={mockOnChange} />);

      await user.click(screen.getByRole('button', { name: /add filter/i }));
      expect(mockOnChange).toHaveBeenCalledWith({
        filters: [{ column: '', operator: 'equals', value: '' }],
      });
    });

    it('should handle filter inputs for different operators', () => {
      const formData = {
        ...baseFormData,
        filters: [{ column: 'status', operator: 'is_null' as const, value: '' }],
      };
      const { rerender } = render(
        <ChartDataConfigurationV3 formData={formData} onChange={mockOnChange} />
      );
      expect(screen.queryByPlaceholderText('Enter value')).not.toBeInTheDocument();

      rerender(
        <ChartDataConfigurationV3
          formData={{
            ...baseFormData,
            filters: [{ column: 'status', operator: 'equals' as const, value: '' }],
          }}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
    });

    it('should render filters with different operators correctly', () => {
      const formData = {
        ...baseFormData,
        filters: [
          { column: 'status', operator: 'equals' as const, value: 'active' },
          { column: 'amount', operator: 'is_null' as const, value: '' },
        ],
      };
      render(<ChartDataConfigurationV3 formData={formData} onChange={mockOnChange} />);
      expect(screen.getByText('Data Filters')).toBeInTheDocument();
    });
  });

  describe('Configuration Sections', () => {
    it('should show/hide sections based on chart type', () => {
      const { rerender } = render(
        <ChartDataConfigurationV3 formData={baseFormData} onChange={mockOnChange} />
      );
      expect(screen.getByText('Pagination')).toBeInTheDocument();
      expect(screen.getByText('Sort Configuration')).toBeInTheDocument();

      rerender(
        <ChartDataConfigurationV3
          formData={{ ...baseFormData, chart_type: 'number' }}
          onChange={mockOnChange}
        />
      );
      expect(screen.queryByText('Pagination')).not.toBeInTheDocument();
      expect(screen.queryByText('Sort Configuration')).not.toBeInTheDocument();
    });

    it('should show sort when metrics exist', () => {
      const formData = {
        ...baseFormData,
        dimension_column: 'category',
        metrics: [{ column: 'amount', aggregation: 'sum' }],
      };

      render(<ChartDataConfigurationV3 formData={formData} onChange={mockOnChange} />);
      expect(screen.getByText('Sort Configuration')).toBeInTheDocument();
      expect(screen.queryByText('Configure metrics first')).not.toBeInTheDocument();
    });
  });

  describe('Column Selection', () => {
    it('should render dimension and extra dimension columns for bar charts', () => {
      render(<ChartDataConfigurationV3 formData={baseFormData} onChange={mockOnChange} />);
      expect(screen.getByText('X Axis')).toBeInTheDocument();
      expect(screen.getByText('Extra Dimension')).toBeInTheDocument();
    });

    it('should show table-specific labels', () => {
      render(
        <ChartDataConfigurationV3
          formData={{ ...baseFormData, chart_type: 'table' }}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText('Group By Column')).toBeInTheDocument();
    });
  });

  describe('Auto-prefill', () => {
    it('should auto-prefill when columns load for first time', async () => {
      (chartAutoPrefill.generateAutoPrefilledConfig as jest.Mock).mockReturnValue({
        dimension_column: 'category',
        metrics: [{ column: null, aggregation: 'count' }],
      });

      const formData = {
        title: 'New',
        chart_type: 'bar' as const,
        schema_name: 'public',
        table_name: 'sales',
        computation_type: 'aggregated' as const,
      };
      render(<ChartDataConfigurationV3 formData={formData} onChange={mockOnChange} />);

      await waitFor(() => expect(chartAutoPrefill.generateAutoPrefilledConfig).toHaveBeenCalled());
    });

    it('should not auto-prefill when config exists', () => {
      const formData = { ...baseFormData, dimension_column: 'category' };
      render(<ChartDataConfigurationV3 formData={formData} onChange={mockOnChange} />);
      expect(chartAutoPrefill.generateAutoPrefilledConfig).not.toHaveBeenCalled();
    });
  });

  describe('Metrics Integration', () => {
    it('should update aggregate fields for number chart', async () => {
      const user = userEvent.setup();
      render(
        <ChartDataConfigurationV3
          formData={{ ...baseFormData, chart_type: 'number', metrics: [] }}
          onChange={mockOnChange}
        />
      );

      await user.click(screen.getByTestId('add-metric'));
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.any(Array),
          aggregate_column: 'amount',
          aggregate_function: 'sum',
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle various undefined/null scenarios', () => {
      const formData = {
        chart_type: 'bar' as const,
        schema_name: undefined,
        table_name: undefined,
      };
      render(<ChartDataConfigurationV3 formData={formData as any} onChange={mockOnChange} />);
      expect(screen.getByTestId('chart-type-selector')).toBeInTheDocument();
    });

    it('should handle disabled prop', () => {
      render(<ChartDataConfigurationV3 formData={baseFormData} onChange={mockOnChange} disabled />);
      expect(screen.getByTestId('change-dataset')).toBeDisabled();
    });
  });

  describe('Sort and Pagination', () => {
    it('should render sort configuration for table charts with metrics', () => {
      const formData = {
        ...baseFormData,
        chart_type: 'table' as const,
        dimension_column: 'category',
        metrics: [{ column: 'amount', aggregation: 'sum' }],
      };
      render(<ChartDataConfigurationV3 formData={formData} onChange={mockOnChange} />);
      expect(screen.getByText('Sort Configuration')).toBeInTheDocument();
    });

    it('should render pagination configuration for table charts', () => {
      render(
        <ChartDataConfigurationV3
          formData={{ ...baseFormData, chart_type: 'table' }}
          onChange={mockOnChange}
        />
      );
      expect(screen.getByText('Pagination')).toBeInTheDocument();
    });
  });

  describe('Map Chart Specifics', () => {
    it('should not render dimension/metrics for map charts', () => {
      render(
        <ChartDataConfigurationV3
          formData={{ ...baseFormData, chart_type: 'map' }}
          onChange={mockOnChange}
        />
      );
      expect(screen.queryByText('X Axis')).not.toBeInTheDocument();
      expect(screen.queryByTestId('metrics-selector')).not.toBeInTheDocument();
    });
  });

  describe('Computation Type Variations', () => {
    it('should render metrics selector for aggregated bar charts', () => {
      const formData = {
        ...baseFormData,
        computation_type: 'aggregated' as const,
        dimension_column: 'category',
      };
      render(<ChartDataConfigurationV3 formData={formData} onChange={mockOnChange} />);
      expect(screen.getByTestId('metrics-selector')).toBeInTheDocument();
    });

    it('should render metrics selector for aggregated line charts', () => {
      const formData = {
        ...baseFormData,
        chart_type: 'line' as const,
        computation_type: 'aggregated' as const,
        dimension_column: 'category',
      };
      render(<ChartDataConfigurationV3 formData={formData} onChange={mockOnChange} />);
      expect(screen.getByTestId('metrics-selector')).toBeInTheDocument();
    });

    it('should render metrics selector with maxMetrics=1 for pie charts', () => {
      const formData = {
        ...baseFormData,
        chart_type: 'pie' as const,
        computation_type: 'aggregated' as const,
        dimension_column: 'category',
      };
      render(<ChartDataConfigurationV3 formData={formData} onChange={mockOnChange} />);
      expect(screen.getByTestId('max-metrics')).toHaveTextContent('1');
    });
  });
});
