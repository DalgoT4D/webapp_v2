import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChartBuilder } from '@/components/charts/ChartBuilder';
import {
  useSchemas,
  useTables,
  useColumns,
  useChartData,
  useChartSave,
} from '@/hooks/api/useChart';

// Mock the hooks
jest.mock('@/hooks/api/useChart');
jest.mock('next/dynamic', () => () => {
  const MockECharts = ({ option, style }: any) => (
    <div data-testid="echarts-mock" style={style}>
      Mock ECharts: {JSON.stringify(option)}
    </div>
  );
  return MockECharts;
});

const mockUseSchemas = useSchemas as jest.MockedFunction<typeof useSchemas>;
const mockUseTables = useTables as jest.MockedFunction<typeof useTables>;
const mockUseColumns = useColumns as jest.MockedFunction<typeof useColumns>;
const mockUseChartData = useChartData as jest.MockedFunction<typeof useChartData>;
const mockUseChartSave = useChartSave as jest.MockedFunction<typeof useChartSave>;

describe('ChartBuilder', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();
  const mockSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockUseSchemas.mockReturnValue({
      data: ['public', 'analytics'],
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    });

    mockUseTables.mockReturnValue({
      data: ['users', 'orders', 'products'],
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    });

    mockUseColumns.mockReturnValue({
      data: [
        { name: 'id', data_type: 'integer' },
        { name: 'name', data_type: 'varchar' },
        { name: 'amount', data_type: 'decimal' },
        { name: 'created_at', data_type: 'timestamp' },
      ],
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    });

    mockUseChartData.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    });

    mockUseChartSave.mockReturnValue({
      save: mockSave,
    });
  });

  it('renders chart builder with initial state', () => {
    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    expect(screen.getByText('Chart Builder')).toBeInTheDocument();
    expect(screen.getByText('Create interactive charts from your data')).toBeInTheDocument();
    expect(screen.getByText('Step 1: Select Chart Type')).toBeInTheDocument();
    expect(screen.getByText('Progress: 0%')).toBeInTheDocument();
  });

  it('displays chart type selection options', () => {
    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    expect(screen.getByText('Bar Chart')).toBeInTheDocument();
    expect(screen.getByText('Line Chart')).toBeInTheDocument();
    expect(screen.getByText('Pie Chart')).toBeInTheDocument();
  });

  it('shows data processing type selection after chart type is selected', () => {
    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Select bar chart
    fireEvent.click(screen.getByLabelText('Bar Chart'));

    expect(screen.getByText('Step 2: Data Processing')).toBeInTheDocument();
    expect(screen.getByText('Raw Data')).toBeInTheDocument();
    expect(screen.getByText('Aggregated Data')).toBeInTheDocument();
  });

  it('displays schema and table selection after chart type is selected', () => {
    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Select bar chart
    fireEvent.click(screen.getByLabelText('Bar Chart'));

    expect(screen.getByText('Step 3: Data Source')).toBeInTheDocument();
    expect(screen.getByText('Schema')).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
  });

  it('populates schema dropdown with data from API', async () => {
    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Select bar chart
    fireEvent.click(screen.getByLabelText('Bar Chart'));

    // Click on schema dropdown
    fireEvent.click(screen.getByText('Select schema'));

    await waitFor(() => {
      expect(screen.getByText('public')).toBeInTheDocument();
      expect(screen.getByText('analytics')).toBeInTheDocument();
    });
  });

  it('enables table dropdown after schema selection', async () => {
    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Select bar chart
    fireEvent.click(screen.getByLabelText('Bar Chart'));

    // Select schema
    fireEvent.click(screen.getByText('Select schema'));
    fireEvent.click(screen.getByText('public'));

    // Check that table dropdown is enabled
    fireEvent.click(screen.getByText('Select table'));

    await waitFor(() => {
      expect(screen.getByText('users')).toBeInTheDocument();
      expect(screen.getByText('orders')).toBeInTheDocument();
      expect(screen.getByText('products')).toBeInTheDocument();
    });
  });

  it('shows column configuration for raw data charts', async () => {
    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Select bar chart
    fireEvent.click(screen.getByLabelText('Bar Chart'));

    // Select raw data
    fireEvent.click(screen.getByLabelText('Raw Data'));

    // Select schema and table
    fireEvent.click(screen.getByText('Select schema'));
    fireEvent.click(screen.getByText('public'));

    fireEvent.click(screen.getByText('Select table'));
    fireEvent.click(screen.getByText('users'));

    await waitFor(() => {
      expect(screen.getByText('Step 4: Configure Data Mapping')).toBeInTheDocument();
      expect(screen.getByText('X-Axis Column')).toBeInTheDocument();
      expect(screen.getByText('Y-Axis Column')).toBeInTheDocument();
    });
  });

  it('shows aggregation configuration for aggregated data charts', async () => {
    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Select bar chart
    fireEvent.click(screen.getByLabelText('Bar Chart'));

    // Select aggregated data
    fireEvent.click(screen.getByLabelText('Aggregated Data'));

    // Select schema and table
    fireEvent.click(screen.getByText('Select schema'));
    fireEvent.click(screen.getByText('public'));

    fireEvent.click(screen.getByText('Select table'));
    fireEvent.click(screen.getByText('users'));

    await waitFor(() => {
      expect(screen.getByText('Step 4: Configure Data Mapping')).toBeInTheDocument();
      expect(screen.getByText('Dimension Column')).toBeInTheDocument();
      expect(screen.getByText('Aggregate Column')).toBeInTheDocument();
      expect(screen.getByText('Aggregate Function')).toBeInTheDocument();
    });
  });

  it('updates progress bar as user completes steps', () => {
    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Initial progress
    expect(screen.getByText('Progress: 0%')).toBeInTheDocument();

    // Select bar chart
    fireEvent.click(screen.getByLabelText('Bar Chart'));
    expect(screen.getByText('Progress: 20%')).toBeInTheDocument();

    // Select schema
    fireEvent.click(screen.getByText('Select schema'));
    fireEvent.click(screen.getByText('public'));
    expect(screen.getByText('Progress: 40%')).toBeInTheDocument();

    // Select table
    fireEvent.click(screen.getByText('Select table'));
    fireEvent.click(screen.getByText('users'));
    expect(screen.getByText('Progress: 60%')).toBeInTheDocument();
  });

  it('shows chart preview when data is configured', async () => {
    const mockChartData = {
      data: [
        { x: 'A', y: 10 },
        { x: 'B', y: 20 },
        { x: 'C', y: 15 },
      ],
    };

    mockUseChartData.mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    });

    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Configure chart completely
    fireEvent.click(screen.getByLabelText('Bar Chart'));
    fireEvent.click(screen.getByLabelText('Raw Data'));

    fireEvent.click(screen.getByText('Select schema'));
    fireEvent.click(screen.getByText('public'));

    fireEvent.click(screen.getByText('Select table'));
    fireEvent.click(screen.getByText('users'));

    // Select X and Y axes
    fireEvent.click(screen.getByText('Select X-axis'));
    fireEvent.click(screen.getByText('name (varchar)'));

    fireEvent.click(screen.getByText('Select Y-axis'));
    fireEvent.click(screen.getByText('amount (decimal)'));

    await waitFor(() => {
      expect(screen.getByTestId('echarts-mock')).toBeInTheDocument();
    });
  });

  it('shows chart details form when chart is configured', async () => {
    const mockChartData = {
      data: [{ x: 'A', y: 10 }],
    };

    mockUseChartData.mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    });

    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Configure chart completely
    fireEvent.click(screen.getByLabelText('Bar Chart'));
    fireEvent.click(screen.getByLabelText('Raw Data'));

    fireEvent.click(screen.getByText('Select schema'));
    fireEvent.click(screen.getByText('public'));

    fireEvent.click(screen.getByText('Select table'));
    fireEvent.click(screen.getByText('users'));

    fireEvent.click(screen.getByText('Select X-axis'));
    fireEvent.click(screen.getByText('name (varchar)'));

    fireEvent.click(screen.getByText('Select Y-axis'));
    fireEvent.click(screen.getByText('amount (decimal)'));

    await waitFor(() => {
      expect(screen.getByText('Step 5: Chart Details')).toBeInTheDocument();
      expect(screen.getByText('Chart Title *')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Make chart public')).toBeInTheDocument();
    });
  });

  it('enables save button only when chart is properly configured', async () => {
    const mockChartData = {
      data: [{ x: 'A', y: 10 }],
    };

    mockUseChartData.mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    });

    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Initially disabled
    expect(screen.getByText('Save Chart')).toBeDisabled();

    // Configure chart completely
    fireEvent.click(screen.getByLabelText('Bar Chart'));
    fireEvent.click(screen.getByLabelText('Raw Data'));

    fireEvent.click(screen.getByText('Select schema'));
    fireEvent.click(screen.getByText('public'));

    fireEvent.click(screen.getByText('Select table'));
    fireEvent.click(screen.getByText('users'));

    fireEvent.click(screen.getByText('Select X-axis'));
    fireEvent.click(screen.getByText('name (varchar)'));

    fireEvent.click(screen.getByText('Select Y-axis'));
    fireEvent.click(screen.getByText('amount (decimal)'));

    // Add title
    const titleInput = screen.getByPlaceholderText('Enter chart title');
    fireEvent.change(titleInput, { target: { value: 'Test Chart' } });

    await waitFor(() => {
      expect(screen.getByText('Save Chart')).not.toBeDisabled();
    });
  });

  it('calls onSave when chart is saved successfully', async () => {
    const mockChartData = {
      data: [{ x: 'A', y: 10 }],
    };

    mockUseChartData.mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    });

    mockSave.mockResolvedValue({ id: 1, title: 'Test Chart' });

    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Configure chart completely
    fireEvent.click(screen.getByLabelText('Bar Chart'));
    fireEvent.click(screen.getByLabelText('Raw Data'));

    fireEvent.click(screen.getByText('Select schema'));
    fireEvent.click(screen.getByText('public'));

    fireEvent.click(screen.getByText('Select table'));
    fireEvent.click(screen.getByText('users'));

    fireEvent.click(screen.getByText('Select X-axis'));
    fireEvent.click(screen.getByText('name (varchar)'));

    fireEvent.click(screen.getByText('Select Y-axis'));
    fireEvent.click(screen.getByText('amount (decimal)'));

    // Add title
    const titleInput = screen.getByPlaceholderText('Enter chart title');
    fireEvent.change(titleInput, { target: { value: 'Test Chart' } });

    // Save chart
    fireEvent.click(screen.getByText('Save Chart'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith({
        title: 'Test Chart',
        description: '',
        chart_type: 'echarts',
        schema_name: 'public',
        table: 'users',
        config: {
          chartType: 'bar',
          computation_type: 'raw',
          xAxis: 'name',
          yAxis: 'amount',
          dimensions: [],
        },
        is_public: false,
      });
      expect(mockOnSave).toHaveBeenCalledWith({ id: 1, title: 'Test Chart' });
    });
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows loading state when schemas are loading', () => {
    mockUseSchemas.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    });

    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByLabelText('Bar Chart'));

    expect(screen.getByText('Loading schemas...')).toBeInTheDocument();
  });

  it('shows error state when schemas fail to load', () => {
    mockUseSchemas.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Failed to load schemas' },
      mutate: jest.fn(),
      isValidating: false,
    });

    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByLabelText('Bar Chart'));
    fireEvent.click(screen.getByText('Select schema'));

    expect(screen.getByText('Error loading schemas')).toBeInTheDocument();
  });

  it('shows loading state in chart preview', () => {
    mockUseChartData.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    });

    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Configure chart to trigger data loading
    fireEvent.click(screen.getByLabelText('Bar Chart'));
    fireEvent.click(screen.getByLabelText('Raw Data'));

    fireEvent.click(screen.getByText('Select schema'));
    fireEvent.click(screen.getByText('public'));

    fireEvent.click(screen.getByText('Select table'));
    fireEvent.click(screen.getByText('users'));

    fireEvent.click(screen.getByText('Select X-axis'));
    fireEvent.click(screen.getByText('name (varchar)'));

    fireEvent.click(screen.getByText('Select Y-axis'));
    fireEvent.click(screen.getByText('amount (decimal)'));

    expect(screen.getByText('Generating chart data...')).toBeInTheDocument();
  });

  it('resets dependent selections when schema changes', () => {
    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Configure chart
    fireEvent.click(screen.getByLabelText('Bar Chart'));

    // Select schema and table
    fireEvent.click(screen.getByText('Select schema'));
    fireEvent.click(screen.getByText('public'));

    fireEvent.click(screen.getByText('Select table'));
    fireEvent.click(screen.getByText('users'));

    // Change schema
    fireEvent.click(screen.getByText('users'));
    fireEvent.click(screen.getByText('analytics'));

    // Table should be reset
    expect(screen.getByText('Select table')).toBeInTheDocument();
  });

  it('handles aggregated chart configuration correctly', async () => {
    const mockChartData = {
      data: [{ region: 'North', total: 1000 }],
    };

    mockUseChartData.mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    });

    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Configure aggregated chart
    fireEvent.click(screen.getByLabelText('Bar Chart'));
    fireEvent.click(screen.getByLabelText('Aggregated Data'));

    fireEvent.click(screen.getByText('Select schema'));
    fireEvent.click(screen.getByText('public'));

    fireEvent.click(screen.getByText('Select table'));
    fireEvent.click(screen.getByText('users'));

    // Configure aggregation
    fireEvent.click(screen.getByText('Select dimension'));
    fireEvent.click(screen.getByText('name (varchar)'));

    fireEvent.click(screen.getByText('Select column to aggregate'));
    fireEvent.click(screen.getByText('amount (decimal)'));

    fireEvent.click(screen.getByText('Select function'));
    fireEvent.click(screen.getByText('Sum'));

    // Add title and save
    const titleInput = screen.getByPlaceholderText('Enter chart title');
    fireEvent.change(titleInput, { target: { value: 'Aggregated Chart' } });

    fireEvent.click(screen.getByText('Save Chart'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith({
        title: 'Aggregated Chart',
        description: '',
        chart_type: 'echarts',
        schema_name: 'public',
        table: 'users',
        config: {
          chartType: 'bar',
          computation_type: 'aggregated',
          dimension_col: 'name',
          aggregate_col: 'amount',
          aggregate_func: 'sum',
          aggregate_col_alias: '',
          dimensions: [],
        },
        is_public: false,
      });
    });
  });

  it('handles public chart toggle correctly', async () => {
    const mockChartData = {
      data: [{ x: 'A', y: 10 }],
    };

    mockUseChartData.mockReturnValue({
      data: mockChartData,
      isLoading: false,
      error: null,
      mutate: jest.fn(),
      isValidating: false,
    });

    render(<ChartBuilder onSave={mockOnSave} onCancel={mockOnCancel} />);

    // Configure chart
    fireEvent.click(screen.getByLabelText('Bar Chart'));
    fireEvent.click(screen.getByLabelText('Raw Data'));

    fireEvent.click(screen.getByText('Select schema'));
    fireEvent.click(screen.getByText('public'));

    fireEvent.click(screen.getByText('Select table'));
    fireEvent.click(screen.getByText('users'));

    fireEvent.click(screen.getByText('Select X-axis'));
    fireEvent.click(screen.getByText('name (varchar)'));

    fireEvent.click(screen.getByText('Select Y-axis'));
    fireEvent.click(screen.getByText('amount (decimal)'));

    // Add title
    const titleInput = screen.getByPlaceholderText('Enter chart title');
    fireEvent.change(titleInput, { target: { value: 'Public Chart' } });

    // Toggle public
    fireEvent.click(screen.getByLabelText('Make chart public'));

    fireEvent.click(screen.getByText('Save Chart'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          is_public: true,
        })
      );
    });
  });
});
