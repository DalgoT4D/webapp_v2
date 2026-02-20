/**
 * TableChart Component Tests - Ultra-consolidated
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableChart } from '../TableChart';

describe('TableChart', () => {
  const mockData = [
    { id: 1, name: 'John Doe', age: 30, salary: 50000, score: 0.85 },
    { id: 2, name: 'Jane Smith', age: 25, salary: 60000, score: 0.92 },
    { id: 3, name: 'Bob Johnson', age: 35, salary: 55000, score: 0.78 },
  ];

  const defaultConfig = { table_columns: ['name', 'age', 'salary'] };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('States and Basic Rendering', () => {
    it('should render loading, error, and empty states', () => {
      const { rerender } = render(<TableChart data={mockData} isLoading={true} />);
      expect(screen.getByText('Loading table data...')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();

      rerender(<TableChart data={mockData} error="Error" />);
      expect(screen.getByText(/table configuration needs a small adjustment/i)).toBeInTheDocument();

      rerender(<TableChart data={[]} config={{ table_columns: ['name'] }} />);
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('should render table with data and columns', () => {
      render(<TableChart data={mockData} config={defaultConfig} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('id')).not.toBeInTheDocument();
    });

    it('should render all columns when no config', () => {
      render(<TableChart data={mockData} />);
      ['id', 'name', 'age', 'salary'].forEach((col) =>
        expect(screen.getByText(col)).toBeInTheDocument()
      );
    });

    it('should fallback to all columns when table_columns empty', () => {
      const data = [{ name: 'Test', value: 123 }];
      render(<TableChart data={data} config={{ table_columns: [] }} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('value')).toBeInTheDocument();
    });
  });

  describe('Column Formatting', () => {
    it('should format currency, percentage, number, and text', () => {
      const { rerender } = render(
        <TableChart
          data={mockData}
          config={{
            table_columns: ['salary'],
            column_formatting: { salary: { type: 'currency', precision: 2 } },
          }}
        />
      );
      expect(screen.getByText('$50000.00')).toBeInTheDocument();

      rerender(
        <TableChart
          data={mockData}
          config={{
            table_columns: ['score'],
            column_formatting: { score: { type: 'percentage', precision: 1 } },
          }}
        />
      );
      expect(screen.getByText('85.0%')).toBeInTheDocument();

      rerender(
        <TableChart
          data={mockData}
          config={{
            table_columns: ['score'],
            column_formatting: { score: { type: 'number', precision: 3 } },
          }}
        />
      );
      expect(screen.getByText('0.850')).toBeInTheDocument();
    });

    it('should apply prefix and suffix', () => {
      render(
        <TableChart
          data={mockData}
          config={{
            table_columns: ['salary'],
            column_formatting: {
              salary: { type: 'currency', precision: 0, prefix: 'USD ', suffix: '/yr' },
            },
          }}
        />
      );
      expect(screen.getByText('USD $50000/yr')).toBeInTheDocument();
    });

    it('should format using numberFormat types (indian, international, adaptive)', () => {
      const { rerender } = render(
        <TableChart
          data={mockData}
          config={{
            table_columns: ['salary'],
            column_formatting: { salary: { numberFormat: 'indian', precision: 0 } },
          }}
        />
      );
      expect(screen.getByText('50,000')).toBeInTheDocument();

      rerender(
        <TableChart
          data={mockData}
          config={{
            table_columns: ['salary'],
            column_formatting: { salary: { numberFormat: 'international', precision: 2 } },
          }}
        />
      );
      expect(screen.getByText('50,000.00')).toBeInTheDocument();

      rerender(
        <TableChart
          data={[{ id: 1, name: 'Test', value: 1500000 }]}
          config={{
            table_columns: ['value'],
            column_formatting: { value: { numberFormat: 'adaptive_international', precision: 1 } },
          }}
        />
      );
      expect(screen.getByText('1.5M')).toBeInTheDocument();

      rerender(
        <TableChart
          data={[{ id: 1, name: 'Test', value: 1500000 }]}
          config={{
            table_columns: ['value'],
            column_formatting: { value: { numberFormat: 'adaptive_indian', precision: 1 } },
          }}
        />
      );
      expect(screen.getByText('15.0L')).toBeInTheDocument();
    });

    it('should apply prefix and suffix with numberFormat', () => {
      render(
        <TableChart
          data={mockData}
          config={{
            table_columns: ['salary'],
            column_formatting: {
              salary: { numberFormat: 'indian', precision: 0, prefix: '₹', suffix: ' INR' },
            },
          }}
        />
      );
      expect(screen.getByText('₹50,000 INR')).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    const onSort = jest.fn();

    it('should render sortable headers and handle clicks', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <TableChart data={mockData} config={defaultConfig} onSort={onSort} />
      );

      const nameHeader = screen.getByText('name').closest('button');
      expect(nameHeader).toBeInTheDocument();

      await user.click(nameHeader!);
      expect(onSort).toHaveBeenCalledWith('name', 'asc');

      rerender(
        <TableChart
          data={mockData}
          config={{ ...defaultConfig, sort: [{ column: 'name', direction: 'asc' }] }}
          onSort={onSort}
        />
      );
      await user.click(nameHeader!);
      expect(onSort).toHaveBeenCalledWith('name', 'desc');
    });

    it('should show sort icons', () => {
      const { container, rerender } = render(
        <TableChart
          data={mockData}
          config={{ ...defaultConfig, sort: [{ column: 'name', direction: 'asc' }] }}
          onSort={onSort}
        />
      );
      expect(container.querySelector('.lucide-chevron-up')).toBeInTheDocument();

      rerender(
        <TableChart
          data={mockData}
          config={{ ...defaultConfig, sort: [{ column: 'name', direction: 'desc' }] }}
          onSort={onSort}
        />
      );
      expect(container.querySelector('.lucide-chevron-down')).toBeInTheDocument();
    });
  });

  describe('Client-Side Pagination', () => {
    const manyRows = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      name: `Person ${i + 1}`,
      age: 20 + i,
    }));

    it('should paginate and navigate', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <TableChart data={manyRows} config={{ table_columns: ['name', 'age'] }} />
      );

      expect(screen.getByText(/showing 1 to 10 of 50 rows/i)).toBeInTheDocument();
      expect(screen.getByText('Person 1')).toBeInTheDocument();
      expect(screen.queryByText('Person 11')).not.toBeInTheDocument();

      const nextButton = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.querySelector('.lucide-chevron-right')
      );
      await user.click(nextButton!);

      expect(screen.getByText('Person 11')).toBeInTheDocument();
      expect(screen.queryByText('Person 1')).not.toBeInTheDocument();
    });

    it('should disable navigation at boundaries', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <TableChart data={manyRows} config={{ table_columns: ['name'] }} />
      );

      const firstButton = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.querySelector('.lucide-chevron-first')
      ) as HTMLButtonElement;
      expect(firstButton.disabled).toBe(true);

      const lastButton = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.querySelector('.lucide-chevron-last')
      );
      await user.click(lastButton!);

      const nextButton = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.querySelector('.lucide-chevron-right')
      ) as HTMLButtonElement;
      expect(nextButton.disabled).toBe(true);
    });

    it('should use config page_size', () => {
      render(
        <TableChart
          data={manyRows}
          config={{ table_columns: ['name'], pagination: { enabled: true, page_size: 20 } }}
        />
      );
      expect(screen.getByText(/showing 1 to 20 of 50 rows/i)).toBeInTheDocument();
    });
  });

  describe('Server-Side Pagination', () => {
    const serverPagination = {
      page: 1,
      pageSize: 10,
      total: 100,
      onPageChange: jest.fn(),
      onPageSizeChange: jest.fn(),
    };

    it('should handle server pagination', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <TableChart
          data={mockData}
          config={{ table_columns: ['name'] }}
          pagination={serverPagination}
        />
      );

      expect(screen.getByText(/showing 1 to 10 of 100 rows/i)).toBeInTheDocument();

      const nextButton = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.querySelector('.lucide-chevron-right')
      );
      await user.click(nextButton!);
      expect(serverPagination.onPageChange).toHaveBeenCalledWith(2);
    });

    it('should disable navigation on last page', () => {
      const { container } = render(
        <TableChart
          data={mockData}
          config={{ table_columns: ['name'] }}
          pagination={{ ...serverPagination, page: 10 }}
        />
      );

      const nextButton = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.querySelector('.lucide-chevron-right')
      ) as HTMLButtonElement;
      expect(nextButton.disabled).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings and undefined values', () => {
      const { rerender } = render(
        <TableChart data={[{ name: '', age: 30 }]} config={{ table_columns: ['name', 'age'] }} />
      );
      expect(screen.getByText('30')).toBeInTheDocument();

      rerender(
        <TableChart
          data={[{ name: 'Test', value: undefined }]}
          config={{ table_columns: ['name', 'value'] }}
        />
      );
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should handle invalid formatting values', () => {
      const { rerender } = render(
        <TableChart
          data={[{ value: '123.456' }]}
          config={{
            table_columns: ['value'],
            column_formatting: { value: { type: 'number', precision: 2 } },
          }}
        />
      );
      expect(screen.getByText('123.46')).toBeInTheDocument();

      rerender(
        <TableChart
          data={[{ salary: 'not-a-number' }]}
          config={{
            table_columns: ['salary'],
            column_formatting: { salary: { type: 'currency' } },
          }}
        />
      );
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });
  });
});
