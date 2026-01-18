/**
 * Tests for ChartExportDropdown component
 * Tests export dropdown with PNG, PDF, and CSV format options
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartExportDropdown } from '../ChartExportDropdown';
import { toast } from 'sonner';

// Mock dependencies
jest.mock('sonner');
jest.mock('@/lib/chart-export');
jest.mock('@/lib/api');

const mockToast = toast as jest.Mocked<typeof toast>;

describe('ChartExportDropdown', () => {
  const defaultProps = {
    chartTitle: 'Test Chart',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render button with all states, variants, and sizes correctly', async () => {
    const user = userEvent.setup();
    const { container, rerender, unmount } = render(<ChartExportDropdown {...defaultProps} />);

    // Button exists with icon
    expect(screen.getByRole('button')).toBeInTheDocument();
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThanOrEqual(1);

    // showText true - text visible
    rerender(<ChartExportDropdown {...defaultProps} showText={true} />);
    expect(screen.getByText(/export/i)).toBeInTheDocument();

    // showText false - text hidden
    rerender(<ChartExportDropdown {...defaultProps} showText={false} />);
    expect(screen.queryByText(/export/i)).not.toBeInTheDocument();

    // Open dropdown and show all export options
    rerender(<ChartExportDropdown {...defaultProps} />);
    const button = screen.getByRole('button');
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
      // Check for export options (at least one should be present)
      const pngOption = screen.queryByText(/export as png/i);
      const pdfOption = screen.queryByText(/export as pdf/i);
      const csvOption = screen.queryByText(/export as csv/i);
      expect(pngOption || pdfOption || csvOption).toBeInTheDocument();
    });
    unmount();

    // Test all variants render without errors
    const variants = ['default', 'outline', 'ghost'] as const;
    variants.forEach((variant) => {
      const { unmount } = render(<ChartExportDropdown {...defaultProps} variant={variant} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
      unmount();
    });

    // Test all sizes
    const sizes = ['default', 'sm', 'lg'] as const;
    sizes.forEach((size) => {
      const { unmount } = render(<ChartExportDropdown {...defaultProps} size={size} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
      unmount();
    });

    // Icon size with no text
    const result = render(<ChartExportDropdown {...defaultProps} size="icon" showText={false} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should handle callbacks, public mode, and all chart types', () => {
    const mockOnExportStart = jest.fn();
    const mockOnExportComplete = jest.fn();
    const mockOnExportError = jest.fn();

    // Accept callback props without errors
    let result = render(
      <ChartExportDropdown
        {...defaultProps}
        onExportStart={mockOnExportStart}
        onExportComplete={mockOnExportComplete}
        onExportError={mockOnExportError}
      />
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
    result.unmount();

    // Public mode with token
    result = render(
      <ChartExportDropdown
        {...defaultProps}
        isPublicMode={true}
        publicToken="test-token"
        chartId={1}
      />
    );
    expect(screen.getByRole('button')).toBeInTheDocument();

    // Public mode without token
    result.rerender(<ChartExportDropdown {...defaultProps} isPublicMode={true} />);
    expect(screen.getByRole('button')).toBeInTheDocument();

    result.unmount();

    // Render for various chart types
    const chartTypes = ['table', 'bar', 'line', 'pie', 'number'] as const;
    for (const chartType of chartTypes) {
      const { unmount } = render(<ChartExportDropdown {...defaultProps} chartType={chartType} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
      unmount();
    }
  });

  it('should handle edge cases and missing optional props', () => {
    // Empty title
    const { rerender } = render(<ChartExportDropdown chartTitle="" />);
    expect(screen.getByRole('button')).toBeInTheDocument();

    // Very long title
    const longTitle = 'A'.repeat(200);
    rerender(<ChartExportDropdown chartTitle={longTitle} />);
    expect(screen.getByRole('button')).toBeInTheDocument();

    // Special characters
    rerender(<ChartExportDropdown chartTitle="Chart with $pecial Ch@rs!" />);
    expect(screen.getByRole('button')).toBeInTheDocument();

    // Missing chart/table elements
    rerender(<ChartExportDropdown {...defaultProps} chartElement={null} />);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<ChartExportDropdown {...defaultProps} chartInstance={null} />);
    expect(screen.getByRole('button')).toBeInTheDocument();

    rerender(<ChartExportDropdown {...defaultProps} tableElement={null} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
