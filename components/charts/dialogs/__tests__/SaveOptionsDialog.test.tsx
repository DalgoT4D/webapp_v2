/**
 * Tests for SaveOptionsDialog component
 * Tests two-step save dialog with update existing and save as new options
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SaveOptionsDialog } from '../SaveOptionsDialog';

describe('SaveOptionsDialog', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSaveExisting = jest.fn();
  const mockOnSaveAsNew = jest.fn();

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    originalTitle: 'My Chart',
    onSaveExisting: mockOnSaveExisting,
    onSaveAsNew: mockOnSaveAsNew,
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render complete UI with all first step elements', () => {
    const { rerender } = render(<SaveOptionsDialog {...defaultProps} />);

    // All dialog elements
    expect(screen.getByText('Save Chart')).toBeInTheDocument();
    expect(
      screen.getByText('Choose how you want to save your changes to this chart.')
    ).toBeInTheDocument();
    expect(screen.getByText('UPDATE EXISTING CHART')).toBeInTheDocument();
    expect(screen.getByText('Save changes to the current chart')).toBeInTheDocument();
    expect(screen.getByText('SAVE AS NEW CHART')).toBeInTheDocument();
    expect(screen.getByText('Create a new chart with your changes')).toBeInTheDocument();

    // Not visible when closed
    rerender(<SaveOptionsDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Save Chart')).not.toBeInTheDocument();
  });

  it('should complete update existing chart workflow', async () => {
    const user = userEvent.setup();
    render(<SaveOptionsDialog {...defaultProps} />);

    const updateButton = screen.getByText('UPDATE EXISTING CHART').closest('button')!;
    await user.click(updateButton);

    expect(mockOnSaveExisting).toHaveBeenCalledTimes(1);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('should complete save as new chart workflow with validation and navigation', async () => {
    const user = userEvent.setup();
    render(<SaveOptionsDialog {...defaultProps} />);

    // Navigate to name step
    const saveAsNewButton = screen.getByText('SAVE AS NEW CHART').closest('button')!;
    await user.click(saveAsNewButton);

    // Second step UI elements
    await waitFor(() => {
      expect(screen.getByText('Save as New Chart')).toBeInTheDocument();
      expect(screen.getByText('Enter a name for your new chart.')).toBeInTheDocument();
      expect(screen.getAllByText('BACK')[0]).toBeInTheDocument();
      expect(screen.getByText('CREATE NEW CHART')).toBeInTheDocument();

      const input = screen.getByLabelText(/chart name/i) as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('My Chart');
      expect(input).toHaveAttribute('placeholder', 'Enter new chart name');
    });

    // Type in input field
    const input = screen.getByLabelText(/chart name/i);
    await user.clear(input);
    await user.type(input, '  New Chart  ');
    expect(input).toHaveValue('  New Chart  ');

    // Create with trimmed title
    const createButton = screen.getByText('CREATE NEW CHART').closest('button')!;
    await user.click(createButton);

    expect(mockOnSaveAsNew).toHaveBeenCalledWith('New Chart');
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('should handle all error scenarios and validation', async () => {
    const user = userEvent.setup();
    render(<SaveOptionsDialog {...defaultProps} />);

    await user.click(screen.getByText('SAVE AS NEW CHART').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Save as New Chart')).toBeInTheDocument();
    });

    const input = screen.getByLabelText(/chart name/i);

    // Empty title - button disabled
    await user.clear(input);
    let createButton = screen.getByText('CREATE NEW CHART').closest('button')!;
    expect(createButton).toBeDisabled();
    await user.click(createButton);
    expect(mockOnSaveAsNew).not.toHaveBeenCalled();

    // Whitespace only - button disabled
    await user.type(input, '   ');
    createButton = screen.getByText('CREATE NEW CHART').closest('button')!;
    expect(createButton).toBeDisabled();
  });

  it('should handle loading states and button interactions', async () => {
    const user = userEvent.setup();

    // First step loading
    const { rerender } = render(<SaveOptionsDialog {...defaultProps} isLoading={true} />);
    const updateButton = screen.getByText('UPDATE EXISTING CHART').closest('button')!;
    const saveAsNewButton = screen.getByText('SAVE AS NEW CHART').closest('button')!;
    expect(updateButton).toBeDisabled();
    expect(saveAsNewButton).toBeDisabled();

    // Second step loading
    rerender(<SaveOptionsDialog {...defaultProps} isLoading={false} />);
    await user.click(screen.getByText('SAVE AS NEW CHART').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Save as New Chart')).toBeInTheDocument();
    });

    rerender(<SaveOptionsDialog {...defaultProps} isLoading={true} />);
    expect(screen.getByText('CREATING...')).toBeInTheDocument();
    expect(screen.queryByText('CREATE NEW CHART')).not.toBeInTheDocument();

    const backButton = screen.getAllByText('BACK')[0].closest('button')!;
    const createButton = screen.getByText('CREATING...').closest('button')!;
    expect(backButton).toBeDisabled();
    expect(createButton).toBeDisabled();
  });

  it('should handle navigation, state management, and edge cases', async () => {
    const user = userEvent.setup();

    // Back button navigation
    const { rerender } = render(<SaveOptionsDialog {...defaultProps} />);
    await user.click(screen.getByText('SAVE AS NEW CHART').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Save as New Chart')).toBeInTheDocument();
    });

    const backButton = screen.getAllByText('BACK')[0].closest('button')!;
    await user.click(backButton);
    await waitFor(() => {
      expect(screen.getByText('Save Chart')).toBeInTheDocument();
      expect(screen.getByText('UPDATE EXISTING CHART')).toBeInTheDocument();
    });

    // Reset to first step when reopened
    await user.click(screen.getByText('SAVE AS NEW CHART').closest('button')!);
    await waitFor(() => {
      expect(screen.getByText('Save as New Chart')).toBeInTheDocument();
    });
    rerender(<SaveOptionsDialog {...defaultProps} open={false} />);
    rerender(<SaveOptionsDialog {...defaultProps} open={true} />);
    expect(screen.getByText('Save Chart')).toBeInTheDocument();

    // Empty title edge case
    rerender(<SaveOptionsDialog {...defaultProps} originalTitle="" />);
    expect(screen.getByText('Save Chart')).toBeInTheDocument();

    // Very long title edge case
    const longTitle = 'A'.repeat(200);
    rerender(<SaveOptionsDialog {...defaultProps} originalTitle={longTitle} />);
    await user.click(screen.getByText('SAVE AS NEW CHART').closest('button')!);
    await waitFor(() => {
      const input = screen.getByLabelText(/chart name/i) as HTMLInputElement;
      expect(input.value).toBe(longTitle);
    });
  });
});
