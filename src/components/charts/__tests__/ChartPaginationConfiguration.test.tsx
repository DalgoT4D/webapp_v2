/**
 * Tests for ChartPaginationConfiguration component
 * Tests pagination configuration with toggle, page size selection, and custom input
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartPaginationConfiguration } from '../ChartPaginationConfiguration';

// Mock pointer capture for Radix UI
beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = jest.fn();
  HTMLElement.prototype.setPointerCapture = jest.fn();
  HTMLElement.prototype.releasePointerCapture = jest.fn();
});

describe('ChartPaginationConfiguration', () => {
  const mockOnChange = jest.fn();

  const defaultFormData = {
    pagination: {
      enabled: false,
      page_size: 50,
    },
  };

  const defaultProps = {
    formData: defaultFormData,
    onChange: mockOnChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render collapsed/expanded states, handle toggle, and show UI correctly', async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<ChartPaginationConfiguration {...defaultProps} />);

    // Disabled state
    expect(screen.getByText('Pagination: Disabled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enable pagination/i })).toBeInTheDocument();
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector('.border-dashed')).toBeInTheDocument();

    // Enabled state
    const enabledFormData = { pagination: { enabled: true, page_size: 50 } };
    rerender(<ChartPaginationConfiguration formData={enabledFormData} onChange={mockOnChange} />);
    expect(screen.getByText('Pagination: 50 per page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit pagination/i })).toBeInTheDocument();

    // Custom page size
    const customFormData = { pagination: { enabled: true, page_size: 75 } };
    rerender(<ChartPaginationConfiguration formData={customFormData} onChange={mockOnChange} />);
    expect(screen.getByText('Pagination: 75 per page')).toBeInTheDocument();

    // Expand and collapse
    rerender(<ChartPaginationConfiguration {...defaultProps} />);
    const enableButton = screen.getByRole('button', { name: /enable pagination/i });
    await user.click(enableButton);
    await waitFor(() => {
      expect(screen.getByText('Chart Pagination')).toBeInTheDocument();
    });

    const doneButton = screen.getByRole('button', { name: /done/i });
    await user.click(doneButton);
    await waitFor(() => {
      expect(screen.queryByText('Chart Pagination')).not.toBeInTheDocument();
      expect(screen.getByText(/Pagination:/)).toBeInTheDocument();
    });

    // Show all expanded state UI elements correctly
    await user.click(screen.getByRole('button', { name: /enable pagination/i }));
    await waitFor(() => {
      expect(screen.getByText('Chart Pagination')).toBeInTheDocument();
      expect(screen.getByText('Enable Pagination')).toBeInTheDocument();
      expect(screen.getByText('Limit the number of data points shown at once')).toBeInTheDocument();
      expect(screen.getByRole('switch')).not.toBeChecked();
      expect(screen.getByText('Pagination is disabled')).toBeInTheDocument();
      expect(screen.getByText('All data will be shown at once')).toBeInTheDocument();
      expect(screen.queryByText('Items per Page')).not.toBeInTheDocument();
    });

    // Toggle pagination state
    const switchElement = screen.getByRole('switch');
    await user.click(switchElement);
    expect(mockOnChange).toHaveBeenCalledWith({
      pagination: { enabled: true, page_size: 50 },
    });
  });

  it('should handle page size configuration, custom input, and preview updates', async () => {
    const user = userEvent.setup();
    const formData = { pagination: { enabled: true, page_size: 50 } };
    render(<ChartPaginationConfiguration formData={formData} onChange={mockOnChange} />);
    await user.click(screen.getByRole('button', { name: /edit pagination/i }));

    await waitFor(() => {
      // Labels and inputs
      expect(screen.getByText('Items per Page')).toBeInTheDocument();
      expect(screen.getByText('Custom Page Size')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter custom size')).toBeInTheDocument();
      expect(screen.getByText('Enter a value between 1 and 10,000')).toBeInTheDocument();

      // Preview section
      expect(screen.getByText('Preview:')).toBeInTheDocument();
      expect(screen.getByText(/Showing 1-50 of 150 items/)).toBeInTheDocument();
      const prevButton = screen.getByRole('button', { name: /← previous/i });
      const nextButton = screen.getByRole('button', { name: /next →/i });
      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeDisabled();

      // Help tips
      expect(screen.getByText(/Pagination helps improve chart performance/i)).toBeInTheDocument();
      expect(screen.getByText(/Users can navigate through data/i)).toBeInTheDocument();
      expect(screen.getByText(/Smaller page sizes load faster/i)).toBeInTheDocument();
    });

    // Handle custom page size input correctly
    const input = screen.getByPlaceholderText('Enter custom size');
    await user.type(input, '8');
    expect(mockOnChange).toHaveBeenCalledWith({
      pagination: { enabled: true, page_size: 8 },
    });

    // Invalid inputs should not call onChange
    jest.clearAllMocks();
    await user.clear(input);
    await user.type(input, 'abc');
    expect(mockOnChange).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, '-5');
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should handle disabled prop and edge cases', () => {
    // Disable all interactive elements when disabled prop is true
    const { rerender } = render(<ChartPaginationConfiguration {...defaultProps} disabled={true} />);

    // Expand button should be disabled in collapsed state
    const enableButton = screen.getByRole('button', { name: /enable pagination/i });
    expect(enableButton).toBeDisabled();

    // Edit button should be disabled when enabled
    const enabledFormData = { pagination: { enabled: true, page_size: 50 } };
    rerender(
      <ChartPaginationConfiguration
        formData={enabledFormData}
        onChange={mockOnChange}
        disabled={true}
      />
    );
    const editButton = screen.getByRole('button', { name: /edit pagination/i });
    expect(editButton).toBeDisabled();

    // Handle missing or malformed pagination data
    const formData = {} as any;
    rerender(<ChartPaginationConfiguration formData={formData} onChange={mockOnChange} />);
    expect(screen.getByText('Pagination: Disabled')).toBeInTheDocument();
  });
});
