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
jest.mock('@/hooks/api/useChart', () => ({
  useSchemas: jest.fn(),
  useTables: jest.fn(),
  useColumns: jest.fn(),
  useChartData: jest.fn(),
  useChartSave: jest.fn(),
}));

// Mock ECharts
jest.mock('echarts-for-react', () => ({
  __esModule: true,
  default: ({ option, style }: any) => (
    <div data-testid="echarts-mock" style={style}>
      {JSON.stringify(option)}
    </div>
  ),
}));

// Mock toast
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock Radix UI components
jest.mock('@radix-ui/react-radio-group', () => ({
  Root: ({ children, value, onValueChange }: any) => (
    <div role="radiogroup">
      {React.Children.map(children, (child) =>
        React.cloneElement(child, {
          onClick: () => onValueChange && onValueChange(value),
        })
      )}
    </div>
  ),
  Item: ({ value, children, onClick }: any) => (
    <button role="radio" value={value} onClick={onClick}>
      {children}
    </button>
  ),
}));

jest.mock('@radix-ui/react-select', () => ({
  Root: ({ children, value, onValueChange }: any) => (
    <div role="combobox">
      {React.Children.map(children, (child) =>
        React.cloneElement(child, {
          onClick: () => onValueChange && onValueChange(value),
        })
      )}
    </div>
  ),
  Trigger: ({ children }: any) => <button>{children}</button>,
  Value: ({ children }: any) => <span>{children}</span>,
  Content: ({ children }: any) => <div>{children}</div>,
  Item: ({ value, children }: any) => (
    <div role="option" data-value={value}>
      {children}
    </div>
  ),
}));

describe('ChartBuilder', () => {
  const mockSchemas = ['public', 'analytics'];
  const mockTables = ['users', 'orders'];
  const mockColumns = [
    { name: 'id', data_type: 'integer' },
    { name: 'name', data_type: 'string' },
    { name: 'value', data_type: 'number' },
  ];

  beforeEach(() => {
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
    });

    (useChartSave as jest.Mock).mockReturnValue({
      save: jest.fn().mockResolvedValue({ data: { id: 1 } }),
    });
  });

  it('shows progress indicator', () => {
    render(<ChartBuilder />);
    const progressText = screen.getByTestId('progress-indicator');
    expect(progressText).toBeInTheDocument();
    expect(progressText.style.width).toBe('0%');
  });

  it('shows loading state in chart preview', () => {
    (useChartData as jest.Mock).mockReturnValue({
      data: null,
      error: null,
      isLoading: true,
    });

    render(<ChartBuilder />);

    // Configure chart to trigger data loading
    fireEvent.click(screen.getByRole('radio', { name: 'Bar Chart' }));
    fireEvent.click(screen.getByTestId('raw-data-radio'));

    // Loading state should be shown
    expect(screen.getByText('Loading Chart...')).toBeInTheDocument();
  });

  it('resets dependent selections when schema changes', () => {
    render(<ChartBuilder />);

    // Configure chart
    fireEvent.click(screen.getByRole('radio', { name: 'Bar Chart' }));
    fireEvent.click(screen.getByTestId('raw-data-radio'));

    // Select schema and table
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'public' }));

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'users' }));

    // Change schema
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'analytics' }));

    // Table should be reset
    expect(screen.getByRole('combobox')).toHaveTextContent('Select table');
  });

  it('handles aggregated chart configuration correctly', async () => {
    render(<ChartBuilder />);

    // Configure aggregated chart
    fireEvent.click(screen.getByRole('radio', { name: 'Bar Chart' }));
    fireEvent.click(screen.getByTestId('aggregated-data-radio'));

    // Select schema and table
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'public' }));

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'users' }));

    // Select dimension and aggregate columns
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'name (string)' }));

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'value (number)' }));

    // Select aggregate function
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Sum' }));

    // Chart data should be requested with correct configuration
    expect(useChartData).toHaveBeenCalledWith(
      expect.objectContaining({
        chart_type: 'bar',
        computation_type: 'aggregated',
        schema_name: 'public',
        table_name: 'users',
        dimension_col: 'name',
        aggregate_col: 'value',
        aggregate_func: 'sum',
      })
    );
  });

  it('handles public chart toggle correctly', () => {
    render(<ChartBuilder />);

    // Configure chart
    fireEvent.click(screen.getByRole('radio', { name: 'Bar Chart' }));
    fireEvent.click(screen.getByTestId('raw-data-radio'));

    // Select schema and table
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'public' }));

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'users' }));

    // Select columns
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'name (string)' }));

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'value (number)' }));

    // Enter title
    fireEvent.change(screen.getByPlaceholderText(/enter chart title/i), {
      target: { value: 'Test Chart' },
    });

    // Toggle public
    fireEvent.click(screen.getByLabelText(/make chart public/i));

    // Save chart
    fireEvent.click(screen.getByText(/save chart/i));

    // Verify save was called with correct config
    expect(useChartSave().save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Chart',
        is_public: true,
      })
    );
  });
});
