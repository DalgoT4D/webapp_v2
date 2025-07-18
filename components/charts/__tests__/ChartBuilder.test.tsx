import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChartBuilder from '../ChartBuilder';
import {
  useSchemas,
  useTables,
  useColumns,
  useChartData,
  useChartSave,
} from '@/hooks/api/useChart';
import { useToast } from '@/components/ui/use-toast';

// Mock the API hooks
jest.mock('@/hooks/api/useChart');
jest.mock('@/components/ui/use-toast');

// Mock the ChartPreview component
jest.mock('../ChartPreview', () => ({
  ChartPreview: ({ chartData, isLoading, error }: any) => (
    <div data-testid="chart-preview">
      {isLoading && <div>Loading preview...</div>}
      {error && <div>Error: {error}</div>}
      {chartData && <div>Chart Preview</div>}
    </div>
  ),
}));

// Mock ChartExport component
jest.mock('../ChartExport', () => ({
  __esModule: true,
  default: ({ chartRef }: any) => <div data-testid="chart-export">Export</div>,
}));

describe('ChartBuilder Component', () => {
  const mockSchemas = ['public', 'analytics', 'staging'];
  const mockTables = ['sales', 'customers', 'products'];
  const mockColumns = [
    { column_name: 'id', data_type: 'integer' },
    { column_name: 'date', data_type: 'timestamp' },
    { column_name: 'amount', data_type: 'numeric' },
    { column_name: 'category', data_type: 'varchar' },
    { column_name: 'description', data_type: 'text' },
  ];

  const mockOnSave = jest.fn();
  const mockToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useSchemas as jest.Mock).mockReturnValue({
      data: mockSchemas,
      isLoading: false,
      error: null,
    });

    (useTables as jest.Mock).mockReturnValue({
      data: mockTables,
      isLoading: false,
      error: null,
    });

    (useColumns as jest.Mock).mockReturnValue({
      data: mockColumns,
      isLoading: false,
      error: null,
    });

    (useChartData as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
    });

    (useChartSave as jest.Mock).mockReturnValue({
      trigger: jest.fn(),
      isMutating: false,
    });

    (useToast as jest.Mock).mockReturnValue({
      toast: mockToast,
    });
  });

  describe('Chart Type Selection', () => {
    it('should display all 16 chart types', () => {
      render(<ChartBuilder onSave={mockOnSave} />);

      const chartTypes = [
        'Bar Chart',
        'Line Chart',
        'Pie Chart',
        'Scatter Plot',
        'Area Chart',
        'Funnel Chart',
        'Radar Chart',
        'Heat Map',
        'Table',
        'Gauge',
        'Box Plot',
        'Candlestick',
        'Sankey Diagram',
        'Tree Map',
        'Sunburst',
        'Number',
      ];

      chartTypes.forEach((type) => {
        expect(screen.getByText(type)).toBeInTheDocument();
      });
    });

    it('should update computation type based on chart selection', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder onSave={mockOnSave} />);

      // Select pie chart (should be aggregated)
      const pieOption = screen.getByText('Pie Chart');
      await user.click(pieOption.closest('div[role="button"]')!);

      await waitFor(() => {
        expect(screen.getByText('Aggregated Data')).toBeInTheDocument();
      });

      // Select bar chart (should allow raw data)
      const barOption = screen.getByText('Bar Chart');
      await user.click(barOption.closest('div[role="button"]')!);

      await waitFor(() => {
        expect(screen.getByText('Raw Data')).toBeInTheDocument();
      });
    });

    it('should highlight selected chart type', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder onSave={mockOnSave} />);

      const lineOption = screen.getByText('Line Chart');
      const lineButton = lineOption.closest('div[role="button"]')!;

      await user.click(lineButton);

      // Check if the selected chart has the active styling
      expect(lineButton).toHaveClass('ring-2', 'ring-primary');
    });
  });

  describe('Data Source Selection', () => {
    it('should load schemas on mount', () => {
      render(<ChartBuilder onSave={mockOnSave} />);

      expect(useSchemas).toHaveBeenCalled();
    });

    it('should load tables when schema is selected', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder onSave={mockOnSave} />);

      // Open schema dropdown
      const schemaSelect = screen.getByRole('combobox', { name: /schema/i });
      await user.click(schemaSelect);

      // Select 'public' schema
      const publicOption = screen.getByRole('option', { name: 'public' });
      await user.click(publicOption);

      expect(useTables).toHaveBeenCalledWith('public');
    });

    it('should load columns when table is selected', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder onSave={mockOnSave} />);

      // Select schema first
      const schemaSelect = screen.getByRole('combobox', { name: /schema/i });
      await user.click(schemaSelect);
      await user.click(screen.getByRole('option', { name: 'public' }));

      // Then select table
      const tableSelect = screen.getByRole('combobox', { name: /table/i });
      await user.click(tableSelect);
      await user.click(screen.getByRole('option', { name: 'sales' }));

      expect(useColumns).toHaveBeenCalledWith('public', 'sales');
    });

    it('should show loading states appropriately', () => {
      (useSchemas as jest.Mock).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<ChartBuilder onSave={mockOnSave} />);

      const schemaSelect = screen.getByRole('combobox', { name: /schema/i });
      expect(within(schemaSelect).getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Column Compatibility Validation', () => {
    it('should filter numeric columns for Y-axis in bar chart', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder onSave={mockOnSave} />);

      // Setup: select bar chart, schema, and table
      await user.click(screen.getByText('Bar Chart').closest('div[role="button"]')!);

      const schemaSelect = screen.getByRole('combobox', { name: /schema/i });
      await user.click(schemaSelect);
      await user.click(screen.getByRole('option', { name: 'public' }));

      const tableSelect = screen.getByRole('combobox', { name: /table/i });
      await user.click(tableSelect);
      await user.click(screen.getByRole('option', { name: 'sales' }));

      // Check Y-axis options
      const yAxisSelect = screen.getByRole('combobox', { name: /y-axis/i });
      await user.click(yAxisSelect);

      // Should show numeric columns
      expect(screen.getByRole('option', { name: 'amount' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'id' })).toBeInTheDocument();

      // Should not show text columns
      expect(screen.queryByRole('option', { name: 'category' })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'description' })).not.toBeInTheDocument();
    });

    it('should handle aggregated chart configuration', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder onSave={mockOnSave} />);

      // Select pie chart (aggregated)
      await user.click(screen.getByText('Pie Chart').closest('div[role="button"]')!);

      // Configure data source
      const schemaSelect = screen.getByRole('combobox', { name: /schema/i });
      await user.click(schemaSelect);
      await user.click(screen.getByRole('option', { name: 'public' }));

      const tableSelect = screen.getByRole('combobox', { name: /table/i });
      await user.click(tableSelect);
      await user.click(screen.getByRole('option', { name: 'sales' }));

      // Should show aggregation options
      expect(screen.getByLabelText(/dimension column/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/aggregation function/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/measure column/i)).toBeInTheDocument();
    });
  });

  describe('Sample Data Mode', () => {
    it('should toggle between sample and real data modes', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder onSave={mockOnSave} />);

      const sampleDataSwitch = screen.getByRole('switch', { name: /use sample data/i });

      // Enable sample data
      await user.click(sampleDataSwitch);

      await waitFor(() => {
        expect(screen.getByText(/using sample data for preview/i)).toBeInTheDocument();
        expect(screen.queryByRole('combobox', { name: /schema/i })).not.toBeInTheDocument();
      });

      // Disable sample data
      await user.click(sampleDataSwitch);

      await waitFor(() => {
        expect(screen.queryByText(/using sample data for preview/i)).not.toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: /schema/i })).toBeInTheDocument();
      });
    });

    it('should generate preview with sample data', async () => {
      const user = userEvent.setup();
      const mockChartData = {
        option: {
          xAxis: { data: ['A', 'B', 'C'] },
          series: [{ data: [10, 20, 30] }],
        },
      };

      (useChartData as jest.Mock).mockReturnValue({
        data: mockChartData,
        isLoading: false,
        error: null,
        mutate: jest.fn(),
      });

      render(<ChartBuilder onSave={mockOnSave} />);

      // Enable sample data
      const sampleDataSwitch = screen.getByRole('switch', { name: /use sample data/i });
      await user.click(sampleDataSwitch);

      // Check preview is rendered
      expect(screen.getByTestId('chart-preview')).toHaveTextContent('Chart Preview');
    });
  });

  describe('Form Submission', () => {
    it('should validate required fields before submission', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder onSave={mockOnSave} />);

      const saveButton = screen.getByRole('button', { name: /save chart/i });
      await user.click(saveButton);

      // Should show validation toast
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Validation Error',
            variant: 'destructive',
          })
        );
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should submit with correct payload structure', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder onSave={mockOnSave} />);

      // Fill in all required fields
      await user.type(screen.getByLabelText(/title/i), 'Sales Dashboard');
      await user.type(screen.getByLabelText(/description/i), 'Monthly sales data');

      // Select chart type
      await user.click(screen.getByText('Bar Chart').closest('div[role="button"]')!);

      // Select schema
      const schemaSelect = screen.getByRole('combobox', { name: /schema/i });
      await user.click(schemaSelect);
      await user.click(screen.getByRole('option', { name: 'public' }));

      // Select table
      const tableSelect = screen.getByRole('combobox', { name: /table/i });
      await user.click(tableSelect);
      await user.click(screen.getByRole('option', { name: 'sales' }));

      // Select axes
      const xAxisSelect = screen.getByRole('combobox', { name: /x-axis/i });
      await user.click(xAxisSelect);
      await user.click(screen.getByRole('option', { name: 'date' }));

      const yAxisSelect = screen.getByRole('combobox', { name: /y-axis/i });
      await user.click(yAxisSelect);
      await user.click(screen.getByRole('option', { name: 'amount' }));

      // Save
      const saveButton = screen.getByRole('button', { name: /save chart/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          title: 'Sales Dashboard',
          description: 'Monthly sales data',
          chart_type: 'echarts',
          schema_name: 'public',
          table: 'sales',
          config: {
            chartType: 'bar',
            computation_type: 'raw',
            xAxis: 'date',
            yAxis: 'amount',
            dimensions: [],
          },
          is_public: false,
        });
      });
    });

    it('should handle save errors gracefully', async () => {
      const user = userEvent.setup();
      mockOnSave.mockRejectedValueOnce(new Error('Save failed'));

      render(<ChartBuilder onSave={mockOnSave} />);

      // Fill minimum required fields
      await user.type(screen.getByLabelText(/title/i), 'Test Chart');

      // Use sample data for quick setup
      await user.click(screen.getByRole('switch', { name: /use sample data/i }));

      // Save
      const saveButton = screen.getByRole('button', { name: /save chart/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Error',
            description: 'Failed to save chart',
            variant: 'destructive',
          })
        );
      });
    });
  });

  describe('Preview Mode', () => {
    it('should toggle preview visibility', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder onSave={mockOnSave} />);

      const previewToggle = screen.getByRole('button', { name: /preview/i });

      // Initially preview should be visible
      expect(screen.getByTestId('chart-preview')).toBeInTheDocument();

      // Hide preview
      await user.click(previewToggle);
      expect(screen.queryByTestId('chart-preview')).not.toBeInTheDocument();

      // Show preview again
      await user.click(previewToggle);
      expect(screen.getByTestId('chart-preview')).toBeInTheDocument();
    });
  });

  describe('Chart Type Specific Configurations', () => {
    it('should show appropriate options for number chart', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder onSave={mockOnSave} />);

      // Select number chart
      await user.click(screen.getByText('Number').closest('div[role="button"]')!);

      // Configure data source
      const schemaSelect = screen.getByRole('combobox', { name: /schema/i });
      await user.click(schemaSelect);
      await user.click(screen.getByRole('option', { name: 'public' }));

      const tableSelect = screen.getByRole('combobox', { name: /table/i });
      await user.click(tableSelect);
      await user.click(screen.getByRole('option', { name: 'sales' }));

      // Number chart should only need aggregation settings
      expect(screen.getByLabelText(/aggregation function/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/measure column/i)).toBeInTheDocument();

      // Should not show dimension column for number chart
      expect(screen.queryByLabelText(/dimension column/i)).not.toBeInTheDocument();
    });

    it('should configure scatter plot correctly', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder onSave={mockOnSave} />);

      // Select scatter plot
      await user.click(screen.getByText('Scatter Plot').closest('div[role="button"]')!);

      // Should default to raw data
      expect(screen.getByText('Raw Data')).toBeInTheDocument();

      // Configure data source
      const schemaSelect = screen.getByRole('combobox', { name: /schema/i });
      await user.click(schemaSelect);
      await user.click(screen.getByRole('option', { name: 'public' }));

      const tableSelect = screen.getByRole('combobox', { name: /table/i });
      await user.click(tableSelect);
      await user.click(screen.getByRole('option', { name: 'sales' }));

      // Should show X and Y axis options
      expect(screen.getByLabelText(/x-axis/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/y-axis/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ChartBuilder onSave={mockOnSave} />);

      expect(screen.getByLabelText(/chart title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/chart description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/computation type/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ChartBuilder onSave={mockOnSave} />);

      // Tab through form elements
      await user.tab();
      expect(screen.getByLabelText(/title/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/description/i)).toHaveFocus();
    });
  });
});
