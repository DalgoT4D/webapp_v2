// components/explore/__tests__/StatisticsPane.test.tsx
import { render, screen } from '@testing-library/react';
import { StatisticsPane } from '../StatisticsPane';
import { mockTableColumnsWithTypes } from './explore-mock-data';

// Mock echarts
jest.mock('echarts/core', () => ({
  use: jest.fn(),
  init: jest.fn(),
}));

jest.mock('echarts/charts', () => ({
  BarChart: {},
  ScatterChart: {},
}));

jest.mock('echarts/components', () => ({
  GridComponent: {},
  TooltipComponent: {},
  LegendComponent: {},
  MarkLineComponent: {},
  MarkPointComponent: {},
}));

jest.mock('echarts/renderers', () => ({
  CanvasRenderer: {},
}));

// Mock chart components to avoid ECharts initialization
jest.mock('../charts/NumberInsights', () => ({
  NumberInsights: () => <div data-testid="number-insights">Number Insights</div>,
}));

jest.mock('../charts/StringInsights', () => ({
  StringInsights: () => <div data-testid="string-insights">String Insights</div>,
}));

jest.mock('../charts/RangeChart', () => ({
  RangeChart: () => <div data-testid="range-chart">Range Chart</div>,
}));

jest.mock('../charts/DateTimeInsights', () => ({
  DateTimeInsights: () => <div data-testid="datetime-insights">DateTime Insights</div>,
}));

// Mock the hooks
jest.mock('@/hooks/api/useWarehouse', () => ({
  useTableColumnTypes: jest.fn(() => ({
    data: [],
    isLoading: false,
  })),
  useTableCount: jest.fn(() => ({
    data: { total_rows: 0 },
    isLoading: false,
  })),
  requestTableMetrics: jest.fn(() => Promise.resolve({ task_id: 'task-123' })),
  useTaskStatus: jest.fn(() => ({
    data: null,
  })),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('StatisticsPane Component', () => {
  const defaultProps = {
    schema: 'public',
    table: 'users',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default state with rows
    const { useTableCount, useTableColumnTypes } = jest.requireMock('@/hooks/api/useWarehouse');
    useTableColumnTypes.mockReturnValue({
      data: mockTableColumnsWithTypes,
      isLoading: false,
    });
    useTableCount.mockReturnValue({
      data: { total_rows: 100 },
      isLoading: false,
    });
  });

  it('renders the table name in header', () => {
    render(<StatisticsPane {...defaultProps} />);
    expect(screen.getByTestId('statistics-table-name')).toHaveTextContent('public.users');
  });

  it('renders refresh button', () => {
    render(<StatisticsPane {...defaultProps} />);
    expect(screen.getByTestId('refresh-stats-btn')).toBeInTheDocument();
  });

  it('shows empty state when no rows', () => {
    const { useTableCount, useTableColumnTypes } = jest.requireMock('@/hooks/api/useWarehouse');
    useTableColumnTypes.mockReturnValue({
      data: [],
      isLoading: false,
    });
    useTableCount.mockReturnValue({
      data: { total_rows: 0 },
      isLoading: false,
    });

    render(<StatisticsPane {...defaultProps} />);
    expect(screen.getByText('No data (0 rows) available')).toBeInTheDocument();
  });

  it('renders sortable column headers', () => {
    render(<StatisticsPane {...defaultProps} />);
    expect(screen.getByTestId('sort-column-name')).toBeInTheDocument();
    expect(screen.getByTestId('sort-column-type')).toBeInTheDocument();
  });
});

describe('StatisticsPane with columns', () => {
  const defaultProps = {
    schema: 'public',
    table: 'users',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    const { useTableColumnTypes, useTableCount } = jest.requireMock('@/hooks/api/useWarehouse');

    useTableColumnTypes.mockReturnValue({
      data: mockTableColumnsWithTypes,
      isLoading: false,
    });

    useTableCount.mockReturnValue({
      data: { total_rows: 100 },
      isLoading: false,
    });
  });

  it('renders rows for each column', () => {
    render(<StatisticsPane {...defaultProps} />);

    // Check that rows are rendered for each column type
    expect(screen.getByTestId('stats-row-id')).toBeInTheDocument();
    expect(screen.getByTestId('stats-row-name')).toBeInTheDocument();
    expect(screen.getByTestId('stats-row-is_active')).toBeInTheDocument();
    expect(screen.getByTestId('stats-row-created_at')).toBeInTheDocument();
  });

  it('shows column count and row count', () => {
    render(<StatisticsPane {...defaultProps} />);
    expect(screen.getByText(/4 columns/)).toBeInTheDocument();
    expect(screen.getByText(/100 rows/)).toBeInTheDocument();
  });
});

describe('StatisticsPane loading state', () => {
  const defaultProps = {
    schema: 'public',
    table: 'users',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    const { useTableColumnTypes, useTableCount } = jest.requireMock('@/hooks/api/useWarehouse');

    useTableColumnTypes.mockReturnValue({
      data: null,
      isLoading: true,
    });

    useTableCount.mockReturnValue({
      data: { total_rows: 100 },
      isLoading: true,
    });
  });

  it('shows loading state with header', () => {
    render(<StatisticsPane {...defaultProps} />);
    // In loading state, the header is still rendered
    expect(screen.getByTestId('statistics-table-name')).toBeInTheDocument();
    // Refresh button should be disabled
    expect(screen.getByTestId('refresh-stats-btn')).toBeDisabled();
  });
});
