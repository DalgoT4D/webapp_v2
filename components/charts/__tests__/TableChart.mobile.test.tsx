/**
 * TableChart narrow-layout (mobile / small chart cell) tests.
 *
 * jsdom has no layout engine and stubs ResizeObserver (jest.setup.ts), so the container
 * width is mocked here. These tests assert the layout decisions the component makes for a
 * given width — they cannot verify the resulting visual fit, which was checked manually.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { TableChart } from '../TableChart';

// Mocked container width, driven per test. Must be `mock`-prefixed for the jest.mock factory.
let mockContainerWidth = 0;
const mockRef: { current: HTMLDivElement | null } = { current: null };
jest.mock('@/hooks/useResizeObserver', () => ({
  useResizeObserver: () => ({ ref: mockRef, width: mockContainerWidth, height: 0 }),
}));

// Viewport fallback used when the container has not been measured yet.
let mockIsMobileViewport = false;
jest.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockIsMobileViewport,
}));

/** Width that puts the table in narrow layout (below NARROW_TABLE_WIDTH_PX). */
const NARROW_WIDTH = 320;
/** Width comfortably above the narrow threshold. */
const WIDE_WIDTH = 900;

describe('TableChart - narrow layout', () => {
  const mockData = [
    { region: 'Kutch district, Gujarat', beneficiaries: 1200, spend: 450000 },
    { region: 'Bhavnagar district, Gujarat', beneficiaries: 900, spend: 310000 },
  ];
  const config = { table_columns: ['region', 'beneficiaries', 'spend'] };

  beforeEach(() => {
    mockContainerWidth = 0;
    mockIsMobileViewport = false;
  });

  const cell = (container: HTMLElement, rowIdx: number, colIdx: number) =>
    container.querySelector(`[data-search-cell="${rowIdx}-${colIdx}"]`) as HTMLElement;

  /** The inner clamp element that caps the column width in narrow layout. */
  const clamp = (container: HTMLElement, rowIdx: number, colIdx: number) =>
    cell(container, rowIdx, colIdx).querySelector('div.truncate') as HTMLElement | null;

  describe('Cell truncation', () => {
    it('should clamp cell width and expose the full value via title when narrow', () => {
      mockContainerWidth = NARROW_WIDTH;
      const { container } = render(<TableChart data={mockData} config={config} />);

      // Clamp sits on an inner block element — max-width on a <td> is ignored under
      // table-layout: auto, which is what let the table grow past the viewport.
      const inner = clamp(container, 0, 0);
      expect(inner).not.toBeNull();
      expect(inner!.style.maxWidth).toBe('140px');
      expect(cell(container, 0, 0)).toHaveAttribute('title', 'Kutch district, Gujarat');
    });

    it('should not clamp or add titles at desktop width', () => {
      mockContainerWidth = WIDE_WIDTH;
      const { container } = render(<TableChart data={mockData} config={config} />);

      expect(clamp(container, 0, 0)).toBeNull();
      expect(cell(container, 0, 0)).not.toHaveAttribute('title');
    });

    it('should fall back to the mobile viewport check before the container is measured', () => {
      mockContainerWidth = 0;
      mockIsMobileViewport = true;
      const { container } = render(<TableChart data={mockData} config={config} />);

      expect(clamp(container, 0, 0)).not.toBeNull();
    });

    it('should stay in desktop layout when unmeasured on a desktop viewport', () => {
      mockContainerWidth = 0;
      mockIsMobileViewport = false;
      const { container } = render(<TableChart data={mockData} config={config} />);

      expect(clamp(container, 0, 0)).toBeNull();
    });
  });

  describe('Frozen first column', () => {
    it('should freeze the first column when narrow even if the chart config disables it', () => {
      mockContainerWidth = NARROW_WIDTH;
      const { container } = render(
        <TableChart data={mockData} config={{ ...config, freezeFirstColumn: false }} />
      );

      expect(cell(container, 0, 0)).toHaveClass('sticky');
      expect(cell(container, 0, 1)).not.toHaveClass('sticky');
      expect(screen.getByText('region').closest('th')).toHaveClass('sticky');
    });

    it('should not freeze a single-column table when narrow', () => {
      mockContainerWidth = NARROW_WIDTH;
      const { container } = render(
        <TableChart data={mockData} config={{ table_columns: ['region'] }} />
      );

      expect(cell(container, 0, 0)).not.toHaveClass('sticky');
    });

    it('should keep honouring the chart config at desktop width', () => {
      mockContainerWidth = WIDE_WIDTH;
      const { container, rerender } = render(
        <TableChart data={mockData} config={{ ...config, freezeFirstColumn: false }} />
      );
      expect(cell(container, 0, 0)).not.toHaveClass('sticky');

      rerender(<TableChart data={mockData} config={{ ...config, freezeFirstColumn: true }} />);
      expect(cell(container, 0, 0)).toHaveClass('sticky');
    });
  });

  describe('Pagination footer', () => {
    const manyRows = Array.from({ length: 50 }, (_, i) => ({
      region: `Region ${i + 1}`,
      beneficiaries: i * 10,
    }));
    const manyRowsConfig = { table_columns: ['region', 'beneficiaries'] };

    it('should drop the row-count text, page-size select and first/last jumps when narrow', () => {
      mockContainerWidth = NARROW_WIDTH;
      render(<TableChart data={manyRows} config={manyRowsConfig} />);

      expect(screen.queryByText(/showing 1 to 10 of 50 rows/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('table-page-size-select')).not.toBeInTheDocument();
      expect(screen.queryByTestId('table-pagination-first-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('table-pagination-last-btn')).not.toBeInTheDocument();
    });

    it('should keep prev/next and the page indicator when narrow', () => {
      mockContainerWidth = NARROW_WIDTH;
      render(<TableChart data={manyRows} config={manyRowsConfig} />);

      expect(screen.getByTestId('table-pagination-prev-btn')).toBeInTheDocument();
      expect(screen.getByTestId('table-pagination-next-btn')).toBeInTheDocument();
      expect(screen.getByTestId('table-pagination-page-indicator')).toHaveTextContent(
        'Page 1 of 5'
      );
    });

    it('should use 40px touch targets when narrow and 32px on desktop', () => {
      mockContainerWidth = NARROW_WIDTH;
      const { rerender } = render(<TableChart data={manyRows} config={manyRowsConfig} />);
      expect(screen.getByTestId('table-pagination-next-btn')).toHaveClass('h-10', 'w-10');

      mockContainerWidth = WIDE_WIDTH;
      rerender(<TableChart data={[...manyRows]} config={manyRowsConfig} />);
      expect(screen.getByTestId('table-pagination-next-btn')).toHaveClass('h-8', 'w-8');
    });

    it('should wrap instead of overflowing', () => {
      mockContainerWidth = NARROW_WIDTH;
      render(<TableChart data={manyRows} config={manyRowsConfig} />);

      expect(screen.getByTestId('table-pagination-footer')).toHaveClass('flex-wrap');
    });

    it('should keep the full desktop footer above the narrow threshold', () => {
      mockContainerWidth = WIDE_WIDTH;
      render(<TableChart data={manyRows} config={manyRowsConfig} />);

      expect(screen.getByText(/showing 1 to 10 of 50 rows/i)).toBeInTheDocument();
      expect(screen.getByTestId('table-page-size-select')).toBeInTheDocument();
      expect(screen.getByTestId('table-pagination-first-btn')).toBeInTheDocument();
      expect(screen.getByTestId('table-pagination-last-btn')).toBeInTheDocument();
    });
  });

  describe('Search bar', () => {
    it('should still render when narrow', () => {
      mockContainerWidth = NARROW_WIDTH;
      render(<TableChart data={mockData} config={config} />);

      expect(screen.getByTestId('table-search-bar')).toBeInTheDocument();
      expect(screen.getByTestId('table-search-input')).toBeInTheDocument();
    });
  });

  describe('Container measurement across states', () => {
    it('should keep the measured wrapper mounted while loading so the observer stays attached', () => {
      const { rerender } = render(<TableChart data={[]} isLoading={true} />);
      const wrapperWhileLoading = screen.getByTestId('table-chart');
      expect(screen.getByText('Loading table data...')).toBeInTheDocument();

      mockContainerWidth = NARROW_WIDTH;
      rerender(<TableChart data={mockData} config={config} isLoading={false} />);

      // Same DOM node reused → the ResizeObserver attached on mount keeps measuring.
      expect(screen.getByTestId('table-chart')).toBe(wrapperWhileLoading);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });
});
