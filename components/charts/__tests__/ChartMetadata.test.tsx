/**
 * Tests for ChartMetadata component
 * Tests UI rendering and form input functionality
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartMetadata } from '../ChartMetadata';
import type { ChartBuilderFormData } from '@/types/charts';

describe('ChartMetadata', () => {
  const mockFormData: ChartBuilderFormData = {
    title: '',
    description: '',
    chart_type: 'bar',
    is_public: false,
  };

  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render complete UI and handle all input interactions', async () => {
    const user = userEvent.setup();

    // Rendering
    render(<ChartMetadata formData={mockFormData} onChange={mockOnChange} />);
    const titleInput = screen.getByLabelText(/chart title/i);
    expect(titleInput).toBeInTheDocument();
    expect(titleInput).toHaveAttribute('id', 'title');
    expect(titleInput).toBeRequired();
    const label = screen.getByText(/chart title/i);
    expect(label).toHaveTextContent('*');
    expect(label).toHaveAttribute('for', 'title');
    const placeholder = screen.getByPlaceholderText(/enter a descriptive title/i);
    expect(placeholder).toBeInTheDocument();

    // Basic typing
    await user.type(titleInput, 'New Chart');
    expect(mockOnChange).toHaveBeenCalled();
    expect(mockOnChange).toHaveBeenCalledWith({ title: 'N' });
    expect(mockOnChange).toHaveBeenCalledWith({ title: 'e' });

    // Clear input
    mockOnChange.mockClear();
    await user.clear(titleInput);
    await user.type(titleInput, 'Revenue');
    const calls = mockOnChange.mock.calls;
    expect(calls[calls.length - 1][0].title).toBe('e');

    // Paste text
    mockOnChange.mockClear();
    await user.clear(titleInput);
    await user.click(titleInput);
    await user.paste('Pasted Title');
    expect(mockOnChange).toHaveBeenCalled();

    // Special characters
    mockOnChange.mockClear();
    await user.clear(titleInput);
    await user.type(titleInput, 'Sales & Revenue (2024)');
    expect(mockOnChange).toHaveBeenCalled();

    // Long titles
    mockOnChange.mockClear();
    await user.clear(titleInput);
    const longTitle = 'A'.repeat(50);
    await user.type(titleInput, longTitle);
    expect(mockOnChange).toHaveBeenCalledTimes(50);

    // Whitespace
    mockOnChange.mockClear();
    await user.clear(titleInput);
    await user.type(titleInput, '   ');
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('should display correct values and handle state variations', () => {
    // Existing value
    const formDataWithTitle: ChartBuilderFormData = { ...mockFormData, title: 'Sales Dashboard' };
    const { rerender } = render(
      <ChartMetadata formData={formDataWithTitle} onChange={mockOnChange} />
    );
    expect(screen.getByDisplayValue('Sales Dashboard')).toBeInTheDocument();

    // Empty title
    rerender(<ChartMetadata formData={mockFormData} onChange={mockOnChange} />);
    let titleInput = screen.getByLabelText(/chart title/i);
    expect(titleInput).toHaveValue('');

    // Null title
    const formDataWithNullTitle: ChartBuilderFormData = { ...mockFormData, title: null as any };
    rerender(<ChartMetadata formData={formDataWithNullTitle} onChange={mockOnChange} />);
    expect(titleInput).toHaveValue('');

    // Undefined formData
    const emptyFormData = {} as ChartBuilderFormData;
    rerender(<ChartMetadata formData={emptyFormData} onChange={mockOnChange} />);
    titleInput = screen.getByLabelText(/chart title/i);
    expect(titleInput).toHaveValue('');
  });

  it('should handle disabled state correctly', async () => {
    const user = userEvent.setup();

    // Disabled
    const { rerender } = render(
      <ChartMetadata formData={mockFormData} onChange={mockOnChange} disabled={true} />
    );
    let titleInput = screen.getByLabelText(/chart title/i);
    expect(titleInput).toBeDisabled();
    expect(titleInput).toBeRequired();
    await user.type(titleInput, 'Should not work');
    expect(mockOnChange).not.toHaveBeenCalled();

    // Enabled
    rerender(<ChartMetadata formData={mockFormData} onChange={mockOnChange} disabled={false} />);
    titleInput = screen.getByLabelText(/chart title/i);
    expect(titleInput).not.toBeDisabled();

    // Default (enabled)
    rerender(<ChartMetadata formData={mockFormData} onChange={mockOnChange} />);
    titleInput = screen.getByLabelText(/chart title/i);
    expect(titleInput).not.toBeDisabled();

    // Maintain validation when disabled
    rerender(<ChartMetadata formData={mockFormData} onChange={mockOnChange} disabled={true} />);
    expect(titleInput).toBeRequired();
    expect(titleInput).toBeDisabled();
  });

  it('should meet accessibility requirements with keyboard navigation', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <ChartMetadata formData={mockFormData} onChange={mockOnChange} />
        <button>Next Button</button>
      </div>
    );

    // Label association
    const titleInput = screen.getByLabelText(/chart title/i);
    expect(titleInput).toHaveAttribute('id', 'title');
    const label = screen.getByText(/chart title/i);
    expect(label).toHaveAttribute('for', 'title');

    // Keyboard navigation
    await user.tab();
    expect(titleInput).toHaveFocus();
    await user.keyboard('Test Title');
    expect(mockOnChange).toHaveBeenCalled();

    // Tab navigation
    mockOnChange.mockClear();
    titleInput.focus();
    expect(titleInput).toHaveFocus();
    await user.tab();
    expect(titleInput).not.toHaveFocus();
  });
});
