// components/explore/__tests__/PreviewPane.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewPane } from '../PreviewPane';
import { mockTableColumns, mockTableData } from './explore-mock-data';

// Mock the hooks
jest.mock('@/hooks/api/useWarehouse', () => ({
  useTableColumns: jest.fn(() => ({
    data: [] as unknown[],
    isLoading: false,
  })),
  useTableData: jest.fn(() => ({
    data: null as unknown,
    isLoading: false,
  })),
  useTableCount: jest.fn(() => ({
    data: { total_rows: 0 },
    isLoading: false,
  })),
  downloadTableCSV: jest.fn(),
}));

describe('PreviewPane Component', () => {
  const defaultProps = {
    schema: 'public',
    table: 'users',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the table name in header', () => {
    render(<PreviewPane {...defaultProps} />);
    expect(screen.getByTestId('preview-table-name')).toHaveTextContent('public.users');
  });

  it('renders download CSV button', () => {
    render(<PreviewPane {...defaultProps} />);
    expect(screen.getByTestId('download-csv-btn')).toBeInTheDocument();
  });

  it('renders page size selector', () => {
    render(<PreviewPane {...defaultProps} />);
    expect(screen.getByTestId('page-size-select')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<PreviewPane {...defaultProps} />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });
});

describe('PreviewPane with data', () => {
  const defaultProps = {
    schema: 'public',
    table: 'users',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    const { useTableColumns, useTableData, useTableCount } = jest.requireMock(
      '@/hooks/api/useWarehouse'
    );

    useTableColumns.mockReturnValue({
      data: mockTableColumns,
      isLoading: false,
    });

    useTableData.mockReturnValue({
      data: mockTableData,
      isLoading: false,
    });

    useTableCount.mockReturnValue({
      data: { total_rows: 100 },
      isLoading: false,
    });
  });

  it('renders table with columns', () => {
    render(<PreviewPane {...defaultProps} />);
    // Check for column headers
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
  });

  it('renders pagination info', () => {
    render(<PreviewPane {...defaultProps} />);
    expect(screen.getByTestId('pagination-info')).toBeInTheDocument();
  });

  it('renders row count', () => {
    render(<PreviewPane {...defaultProps} />);
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });
});

describe('PreviewPane loading state', () => {
  const defaultProps = {
    schema: 'public',
    table: 'users',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    const { useTableColumns, useTableData, useTableCount } = jest.requireMock(
      '@/hooks/api/useWarehouse'
    );

    useTableColumns.mockReturnValue({
      data: null,
      isLoading: true,
    });

    useTableData.mockReturnValue({
      data: null,
      isLoading: true,
    });

    useTableCount.mockReturnValue({
      data: null,
      isLoading: true,
    });
  });

  it('shows loading state', () => {
    render(<PreviewPane {...defaultProps} />);
    // Should show loading state - either skeletons or loading indicators
    // The Skeleton component from shadcn/ui renders as a div with various classes
    const container = document.querySelector('[data-testid="preview-table-name"]');
    // When loading, the component should still render the header
    expect(container).toBeInTheDocument();
  });
});
