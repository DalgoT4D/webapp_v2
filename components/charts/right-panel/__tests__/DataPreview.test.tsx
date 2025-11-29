/**
 * DataPreview Component Tests
 *
 * Tests the DataPreview component which displays tabular data with:
 * - Loading, error, and empty states
 * - Data table with formatting
 * - Column type indicators
 * - Pagination controls
 *
 * Architecture: Uses parameterized tests to reduce redundancy while maintaining comprehensive coverage.
 * Each test focuses on a specific user behavior or business requirement.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataPreview } from '../DataPreview';

describe('DataPreview', () => {
  const mockOnPageChange = jest.fn();
  const mockOnPageSizeChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Component States
   * Tests the primary states the component can be in: loading, error, empty, and data
   */
  describe('Component States', () => {
    it('should render loading state with spinner', () => {
      render(<DataPreview data={[]} columns={[]} isLoading={true} />);

      expect(screen.getByText('Loading data...')).toBeInTheDocument();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('should render error state with user-friendly message', () => {
      render(<DataPreview data={[]} columns={[]} error={new Error('API Error')} />);

      expect(screen.getByText(/Data preview isn't ready yet/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Please check your query settings and try again/i)
      ).toBeInTheDocument();
    });

    it.each([
      ['no data', [], ['col1', 'col2']],
      ['null data', null, ['col1']],
      ['no columns', [{ name: 'test' }], []],
    ])('should render empty state when %s', (_description, data, columns) => {
      render(<DataPreview data={data as any} columns={columns} />);

      expect(screen.getByText('No data to preview')).toBeInTheDocument();
      expect(screen.getByText('Select a table to see data')).toBeInTheDocument();
    });
  });

  /**
   * Data Table Rendering
   * Tests table structure, columns, rows, and type indicators
   */
  describe('Data Table Rendering', () => {
    const mockData = [
      { id: 1, name: 'Alice', age: 30, salary: 75000 },
      { id: 2, name: 'Bob', age: 25, salary: 65000 },
      { id: 3, name: 'Charlie', age: 35, salary: 85000 },
    ];
    const mockColumns = ['id', 'name', 'age', 'salary'];

    it('should render table with columns and data rows', () => {
      render(<DataPreview data={mockData} columns={mockColumns} />);

      // Verify columns
      mockColumns.forEach((col) => {
        expect(screen.getByText(col)).toBeInTheDocument();
      });

      // Verify data
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('should display column types when provided', () => {
      const columnTypes = {
        id: 'integer',
        name: 'varchar',
        age: 'integer',
        salary: 'numeric',
      };

      render(<DataPreview data={mockData} columns={mockColumns} columnTypes={columnTypes} />);

      expect(screen.getAllByText('integer').length).toBeGreaterThan(0);
      expect(screen.getByText('varchar')).toBeInTheDocument();
      expect(screen.getByText('numeric')).toBeInTheDocument();
    });

    it('should show "unknown" type when columnTypes not provided', () => {
      render(<DataPreview data={mockData} columns={mockColumns} />);

      expect(screen.getAllByText('unknown').length).toBeGreaterThan(0);
    });
  });

  /**
   * Cell Value Formatting
   * Tests how different data types are displayed in cells
   */
  describe('Cell Value Formatting', () => {
    it.each([
      ['null', null, '-'],
      ['undefined', undefined, '-'],
      ['number with decimals', 1234567.89, '1,234,567.89'],
      ['large number', 1000000, '1,000,000'],
      ['zero', 0, '0'],
      ['boolean', true, 'true'],
      ['string', 'test', 'test'],
      ['empty string', '', ''], // Empty strings are preserved
    ])('should format %s values correctly', (_description, value, expected) => {
      const data = [{ id: 1, value }];
      render(<DataPreview data={data} columns={['id', 'value']} />);

      if (expected) {
        expect(screen.getByText(expected)).toBeInTheDocument();
      }
    });

    it('should format Date objects with locale formatting', () => {
      const testDate = new Date('2024-01-15');
      const data = [{ id: 1, created: testDate }];

      render(<DataPreview data={data} columns={['id', 'created']} />);

      const formattedDate = testDate.toLocaleDateString();
      expect(screen.getByText(formattedDate)).toBeInTheDocument();
    });
  });

  /**
   * Column Type Icons
   * Tests the visual indicators for different column data types
   */
  describe('Column Type Icons', () => {
    it.each([
      ['numeric types', ['integer', 'numeric', 'double precision'], '123'],
      ['date types', ['date', 'timestamp'], '📅'],
      ['boolean type', ['boolean'], '✓'],
      ['text types', ['varchar', 'text', 'char'], 'Aa'],
    ])('should show correct icon for %s', (_description, types, expectedIcon) => {
      types.forEach((type) => {
        const columnTypes = { testColumn: type };
        const { unmount } = render(
          <DataPreview
            data={[{ testColumn: 'value' }]}
            columns={['testColumn']}
            columnTypes={columnTypes}
          />
        );

        expect(screen.getByText(expectedIcon)).toBeInTheDocument();
        unmount();
      });
    });
  });

  /**
   * Pagination Controls
   * Tests pagination button behavior, disabled states, and navigation
   */
  describe('Pagination Controls', () => {
    const mockData = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
    }));

    const createPagination = (overrides = {}) => ({
      page: 2,
      pageSize: 10,
      total: 100,
      onPageChange: mockOnPageChange,
      onPageSizeChange: mockOnPageSizeChange,
      ...overrides,
    });

    it('should render all pagination controls', () => {
      render(
        <DataPreview data={mockData} columns={['id', 'name']} pagination={createPagination()} />
      );

      expect(screen.getByRole('button', { name: /first/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /last/i })).toBeInTheDocument();
    });

    it('should display pagination information correctly', () => {
      render(
        <DataPreview data={mockData} columns={['id', 'name']} pagination={createPagination()} />
      );

      expect(screen.getByText(/Showing 11 to 20 of 100 rows/i)).toBeInTheDocument();
      expect(screen.getByText(/Page 2 of 10/i)).toBeInTheDocument();
    });

    it.each([
      ['First', /first/i, 1],
      ['Previous', /previous/i, 1],
      ['Next', /next/i, 3],
      ['Last', /last/i, 10],
    ])(
      'should call onPageChange when clicking %s button',
      async (_label, buttonMatcher, expectedPage) => {
        const user = userEvent.setup();
        render(
          <DataPreview data={mockData} columns={['id', 'name']} pagination={createPagination()} />
        );

        await user.click(screen.getByRole('button', { name: buttonMatcher }));

        expect(mockOnPageChange).toHaveBeenCalledWith(expectedPage);
      }
    );

    it.each([
      ['first page', 1, [/first/i, /previous/i], [/next/i, /last/i]],
      ['last page', 10, [/next/i, /last/i], [/first/i, /previous/i]],
    ])(
      'should disable appropriate buttons on %s',
      (_description, page, disabledButtons, enabledButtons) => {
        render(
          <DataPreview
            data={mockData}
            columns={['id', 'name']}
            pagination={createPagination({ page })}
          />
        );

        disabledButtons.forEach((buttonMatcher) => {
          expect(screen.getByRole('button', { name: buttonMatcher })).toBeDisabled();
        });

        enabledButtons.forEach((buttonMatcher) => {
          expect(screen.getByRole('button', { name: buttonMatcher })).not.toBeDisabled();
        });
      }
    );

    it('should enable all pagination buttons on middle page', () => {
      render(
        <DataPreview
          data={mockData}
          columns={['id', 'name']}
          pagination={createPagination({ page: 5 })}
        />
      );

      [/first/i, /previous/i, /next/i, /last/i].forEach((buttonMatcher) => {
        expect(screen.getByRole('button', { name: buttonMatcher })).not.toBeDisabled();
      });
    });
  });

  /**
   * Page Size Selector
   * Tests the rows-per-page dropdown control
   */
  describe('Page Size Selector', () => {
    const mockData = [{ id: 1, name: 'Test' }];

    it('should render page size selector when onPageSizeChange provided', () => {
      const pagination = {
        page: 1,
        pageSize: 10,
        total: 100,
        onPageChange: mockOnPageChange,
        onPageSizeChange: mockOnPageSizeChange,
      };

      render(<DataPreview data={mockData} columns={['id', 'name']} pagination={pagination} />);

      expect(screen.getByText('Rows per page:')).toBeInTheDocument();
    });

    it('should not render page size selector when onPageSizeChange not provided', () => {
      const pagination = {
        page: 1,
        pageSize: 10,
        total: 100,
        onPageChange: mockOnPageChange,
      };

      render(<DataPreview data={mockData} columns={['id', 'name']} pagination={pagination} />);

      expect(screen.queryByText('Rows per page:')).not.toBeInTheDocument();
    });
  });

  /**
   * Edge Cases and Boundary Conditions
   * Tests component behavior with unusual or boundary data
   */
  describe('Edge Cases', () => {
    it('should handle single row and single column', () => {
      const data = [{ id: 1 }];
      render(<DataPreview data={data} columns={['id']} />);

      expect(screen.getByText('id')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should handle missing/sparse data properties', () => {
      const data = [{ id: 1 }, { id: 2, name: 'Test' }];
      render(<DataPreview data={data} columns={['id', 'name']} />);

      // Missing properties should render as dash
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });

    it('should calculate pagination info correctly for partial last page', () => {
      const mockData = [{ id: 1 }];
      const pagination = {
        page: 5,
        pageSize: 10,
        total: 45, // Last page has only 5 items
        onPageChange: mockOnPageChange,
      };

      render(<DataPreview data={mockData} columns={['id']} pagination={pagination} />);

      expect(screen.getByText(/Showing 41 to 45 of 45 rows/i)).toBeInTheDocument();
    });

    it('should handle very long column names gracefully', () => {
      const longColumnName = 'very_long_column_name_that_should_be_truncated_properly';
      const data = [{ [longColumnName]: 'value' }];

      render(<DataPreview data={data} columns={[longColumnName]} />);

      expect(screen.getByText(longColumnName)).toBeInTheDocument();
    });

    it('should not render pagination when prop is undefined', () => {
      const data = [{ id: 1 }];
      render(<DataPreview data={data} columns={['id']} />);

      expect(screen.queryByRole('button', { name: /first/i })).not.toBeInTheDocument();
    });

    it('should show empty state when total is 0', () => {
      const pagination = {
        page: 1,
        pageSize: 10,
        total: 0,
        onPageChange: mockOnPageChange,
      };

      render(<DataPreview data={[]} columns={[]} pagination={pagination} />);

      expect(screen.getByText('No data to preview')).toBeInTheDocument();
    });
  });
});
