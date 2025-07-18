import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChartBuilder from '@/components/charts/ChartBuilder';
import { SWRConfig } from 'swr';

// Mock the API hooks
jest.mock('@/hooks/api/useWarehouse', () => ({
  useSchemas: () => ({
    data: ['public', 'analytics'],
    isLoading: false,
    error: null,
  }),
  useTables: (schema: string) => ({
    data: schema === 'analytics' ? ['sales', 'customers'] : [],
    isLoading: false,
    error: null,
  }),
  useColumns: (schema: string, table: string) => ({
    data:
      table === 'sales'
        ? [
            { name: 'id', data_type: 'integer' },
            { name: 'date', data_type: 'date' },
            { name: 'product_category', data_type: 'character varying' },
            { name: 'total_amount', data_type: 'numeric' },
            { name: 'quantity', data_type: 'integer' },
          ]
        : [],
    isLoading: false,
    error: null,
  }),
}));

jest.mock('@/hooks/api/useCharts', () => ({
  useChartData: (payload: any) => {
    if (!payload) {
      return { data: null, isLoading: false, error: null };
    }

    return {
      data: {
        chart_config: {
          title: { text: 'Test Chart' },
          xAxis: { type: 'category', data: ['A', 'B', 'C'] },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: [10, 20, 30] }],
        },
        raw_data: {
          data: [
            { category: 'A', value: 10 },
            { category: 'B', value: 20 },
            { category: 'C', value: 30 },
          ],
        },
      },
      isLoading: false,
      error: null,
    };
  },
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock ChartPreview component
jest.mock('@/components/charts/ChartPreview', () => {
  return React.forwardRef(({ chartConfig, chartType }: any, ref: any) => (
    <div data-testid="chart-preview">Chart Preview: {chartType}</div>
  ));
});

describe('ChartBuilder Component', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  const renderChartBuilder = () => {
    return render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />
      </SWRConfig>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the chart builder interface', () => {
    renderChartBuilder();

    expect(screen.getByText('Create Chart')).toBeInTheDocument();
    expect(screen.getByText('Chart Type')).toBeInTheDocument();
    expect(screen.getByText('Select chart type')).toBeInTheDocument();
  });

  it('should allow selecting chart type', async () => {
    const user = userEvent.setup();
    renderChartBuilder();

    // Click on chart type selector
    const chartTypeButton = screen.getByText('Select chart type');
    await user.click(chartTypeButton);

    // Select bar chart
    const barOption = screen.getByText('Bar Chart');
    await user.click(barOption);

    // Should show computation type selection
    expect(screen.getByText('Computation Type')).toBeInTheDocument();
  });

  it('should show schema and table selection after computation type', async () => {
    const user = userEvent.setup();
    renderChartBuilder();

    // Select chart type
    await user.click(screen.getByText('Select chart type'));
    await user.click(screen.getByText('Bar Chart'));

    // Select computation type
    const aggregatedRadio = screen.getByLabelText('Aggregated');
    await user.click(aggregatedRadio);

    // Should show schema selection
    expect(screen.getByText('Select Schema')).toBeInTheDocument();
  });

  it('should cascade selections properly', async () => {
    const user = userEvent.setup();
    renderChartBuilder();

    // Select chart type
    await user.click(screen.getByText('Select chart type'));
    await user.click(screen.getByText('Bar Chart'));

    // Select computation type
    await user.click(screen.getByLabelText('Aggregated'));

    // Select schema
    await user.click(screen.getByText('Select schema'));
    await user.click(screen.getByText('analytics'));

    // Should show table selection
    expect(screen.getByText('Select Table')).toBeInTheDocument();

    // Select table
    await user.click(screen.getByText('Select table'));
    await user.click(screen.getByText('sales'));

    // Should show column configuration
    expect(screen.getByText('Configure Chart')).toBeInTheDocument();
  });

  it('should show different fields for raw vs aggregated', async () => {
    const user = userEvent.setup();
    renderChartBuilder();

    // Setup for raw data
    await user.click(screen.getByText('Select chart type'));
    await user.click(screen.getByText('Line Chart'));
    await user.click(screen.getByLabelText('Raw Data'));
    await user.click(screen.getByText('Select schema'));
    await user.click(screen.getByText('analytics'));
    await user.click(screen.getByText('Select table'));
    await user.click(screen.getByText('sales'));

    // Should show X and Y axis selection for raw
    expect(screen.getByText('X-Axis Column')).toBeInTheDocument();
    expect(screen.getByText('Y-Axis Column')).toBeInTheDocument();

    // Switch to aggregated
    await user.click(screen.getByLabelText('Aggregated'));

    // Should show dimension and aggregate columns
    expect(screen.getByText('Dimension Column')).toBeInTheDocument();
    expect(screen.getByText('Aggregate Column')).toBeInTheDocument();
    expect(screen.getByText('Aggregate Function')).toBeInTheDocument();
  });

  it('should generate preview when all fields are filled', async () => {
    const user = userEvent.setup();
    renderChartBuilder();

    // Fill all required fields
    await user.click(screen.getByText('Select chart type'));
    await user.click(screen.getByText('Bar Chart'));
    await user.click(screen.getByLabelText('Aggregated'));
    await user.click(screen.getByText('Select schema'));
    await user.click(screen.getByText('analytics'));
    await user.click(screen.getByText('Select table'));
    await user.click(screen.getByText('sales'));

    // Select dimension column
    await user.click(screen.getByText('Select dimension column'));
    await user.click(screen.getByText('product_category'));

    // Select aggregate column
    await user.click(screen.getByText('Select aggregate column'));
    await user.click(screen.getByText('total_amount'));

    // Select aggregate function
    await user.click(screen.getByText('Select aggregate function'));
    await user.click(screen.getByText('Sum'));

    // Should show preview
    await waitFor(() => {
      expect(screen.getByTestId('chart-preview')).toBeInTheDocument();
    });
  });

  it('should validate required fields before saving', async () => {
    const user = userEvent.setup();
    renderChartBuilder();

    // Try to save without filling required fields
    // First need to complete the flow to see the save button
    await user.click(screen.getByText('Select chart type'));
    await user.click(screen.getByText('Bar Chart'));
    await user.click(screen.getByLabelText('Aggregated'));
    await user.click(screen.getByText('Select schema'));
    await user.click(screen.getByText('analytics'));
    await user.click(screen.getByText('Select table'));
    await user.click(screen.getByText('sales'));
    await user.click(screen.getByText('Select dimension column'));
    await user.click(screen.getByText('product_category'));
    await user.click(screen.getByText('Select aggregate column'));
    await user.click(screen.getByText('total_amount'));
    await user.click(screen.getByText('Select aggregate function'));
    await user.click(screen.getByText('Sum'));

    // Now the save section should be visible
    const saveButton = screen.getByText('Save Chart');
    await user.click(saveButton);

    // Should not call onSave without title
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should save chart with all data', async () => {
    const user = userEvent.setup();
    renderChartBuilder();

    // Fill all fields
    await user.click(screen.getByText('Select chart type'));
    await user.click(screen.getByText('Bar Chart'));
    await user.click(screen.getByLabelText('Aggregated'));
    await user.click(screen.getByText('Select schema'));
    await user.click(screen.getByText('analytics'));
    await user.click(screen.getByText('Select table'));
    await user.click(screen.getByText('sales'));
    await user.click(screen.getByText('Select dimension column'));
    await user.click(screen.getByText('product_category'));
    await user.click(screen.getByText('Select aggregate column'));
    await user.click(screen.getByText('total_amount'));
    await user.click(screen.getByText('Select aggregate function'));
    await user.click(screen.getByText('Sum'));

    // Enter title and description
    const titleInput = screen.getByPlaceholderText('Enter chart title');
    await user.type(titleInput, 'Test Chart Title');

    const descriptionInput = screen.getByPlaceholderText('Describe what this chart shows');
    await user.type(descriptionInput, 'Test chart description');

    // Save chart
    const saveButton = screen.getByText('Save Chart');
    await user.click(saveButton);

    // Should call onSave with correct data
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Chart Title',
          description: 'Test chart description',
          chart_type: 'echarts',
          schema_name: 'analytics',
          table: 'sales',
          config: expect.objectContaining({
            chartType: 'bar',
            computation_type: 'aggregated',
          }),
        })
      );
    });
  });

  it('should handle cancel action', async () => {
    const user = userEvent.setup();
    renderChartBuilder();

    // Click cancel button
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should show progress indicator', () => {
    renderChartBuilder();

    // Should show progress at 0%
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should update progress as fields are filled', async () => {
    const user = userEvent.setup();
    renderChartBuilder();

    // Initial progress
    expect(screen.getByText('0%')).toBeInTheDocument();

    // Select chart type (20%)
    await user.click(screen.getByText('Select chart type'));
    await user.click(screen.getByText('Bar Chart'));
    expect(screen.getByText('20%')).toBeInTheDocument();

    // Select computation type (40%)
    await user.click(screen.getByLabelText('Aggregated'));
    expect(screen.getByText('40%')).toBeInTheDocument();

    // Select schema (60%)
    await user.click(screen.getByText('Select schema'));
    await user.click(screen.getByText('analytics'));
    expect(screen.getByText('60%')).toBeInTheDocument();

    // Select table (80%)
    await user.click(screen.getByText('Select table'));
    await user.click(screen.getByText('sales'));
    expect(screen.getByText('80%')).toBeInTheDocument();
  });
});
