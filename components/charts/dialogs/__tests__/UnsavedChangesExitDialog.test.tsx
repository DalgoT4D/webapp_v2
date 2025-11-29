/**
 * Tests for UnsavedChangesExitDialog component
 * Tests dialog for unsaved changes with save/leave/stay options
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnsavedChangesExitDialog } from '../UnsavedChangesExitDialog';

describe('UnsavedChangesExitDialog', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSave = jest.fn();
  const mockOnLeave = jest.fn();
  const mockOnStay = jest.fn();

  const defaultProps = {
    open: true,
    onOpenChange: mockOnOpenChange,
    onSave: mockOnSave,
    onLeave: mockOnLeave,
    onStay: mockOnStay,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render complete UI with all elements and handle visibility', () => {
    const { rerender } = render(<UnsavedChangesExitDialog {...defaultProps} />);

    // All dialog elements
    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
    expect(
      screen.getByText('You have unsaved changes. What would you like to do?')
    ).toBeInTheDocument();
    expect(screen.getByText('SAVE AND LEAVE')).toBeInTheDocument();
    expect(screen.getByText(/save your changes and return to charts/i)).toBeInTheDocument();
    expect(screen.getByText('LEAVE WITHOUT SAVING')).toBeInTheDocument();
    expect(screen.getByText(/discard your changes and return to charts/i)).toBeInTheDocument();
    expect(screen.getByText('STAY ON PAGE')).toBeInTheDocument();
    expect(screen.getByText(/continue editing this chart/i)).toBeInTheDocument();

    // Not rendered when closed
    rerender(<UnsavedChangesExitDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Unsaved Changes')).not.toBeInTheDocument();

    // Show again when open
    rerender(<UnsavedChangesExitDialog {...defaultProps} open={true} />);
    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
  });

  it('should handle all button actions correctly', async () => {
    const user = userEvent.setup();

    // Save button
    let { unmount } = render(<UnsavedChangesExitDialog {...defaultProps} />);
    await user.click(screen.getByText('SAVE AND LEAVE').closest('button')!);
    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnLeave).not.toHaveBeenCalled();
    expect(mockOnStay).not.toHaveBeenCalled();
    unmount();

    // Leave button
    jest.clearAllMocks();
    ({ unmount } = render(<UnsavedChangesExitDialog {...defaultProps} />));
    await user.click(screen.getByText('LEAVE WITHOUT SAVING').closest('button')!);
    expect(mockOnLeave).toHaveBeenCalledTimes(1);
    expect(mockOnSave).not.toHaveBeenCalled();
    expect(mockOnStay).not.toHaveBeenCalled();
    unmount();

    // Stay button
    jest.clearAllMocks();
    ({ unmount } = render(<UnsavedChangesExitDialog {...defaultProps} />));
    await user.click(screen.getByText('STAY ON PAGE').closest('button')!);
    expect(mockOnStay).toHaveBeenCalledTimes(1);
    expect(mockOnSave).not.toHaveBeenCalled();
    expect(mockOnLeave).not.toHaveBeenCalled();
    unmount();

    // Rapid clicks
    jest.clearAllMocks();
    render(<UnsavedChangesExitDialog {...defaultProps} />);
    const saveButton = screen.getByText('SAVE AND LEAVE').closest('button')!;
    await user.click(saveButton);
    await user.click(saveButton);
    await user.click(saveButton);
    expect(mockOnSave).toHaveBeenCalledTimes(3);
  });

  it('should handle saving state and disable all buttons correctly', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<UnsavedChangesExitDialog {...defaultProps} isSaving={false} />);

    // Enabled by default
    let saveButton = screen.getByText('SAVE AND LEAVE').closest('button')!;
    expect(saveButton).not.toBeDisabled();

    // Saving state
    rerender(<UnsavedChangesExitDialog {...defaultProps} isSaving={true} />);
    expect(screen.getByText('SAVING...')).toBeInTheDocument();
    expect(screen.queryByText('SAVE AND LEAVE')).not.toBeInTheDocument();

    // All buttons disabled
    saveButton = screen.getByText('SAVING...').closest('button')!;
    const leaveButton = screen.getByText('LEAVE WITHOUT SAVING').closest('button')!;
    const stayButton = screen.getByText('STAY ON PAGE').closest('button')!;

    expect(saveButton).toBeDisabled();
    expect(leaveButton).toBeDisabled();
    expect(stayButton).toBeDisabled();

    // Callbacks not called when disabled
    await user.click(saveButton);
    expect(mockOnSave).not.toHaveBeenCalled();

    // Toggle back to enabled
    rerender(<UnsavedChangesExitDialog {...defaultProps} isSaving={false} />);
    saveButton = screen.getByText('SAVE AND LEAVE').closest('button')!;
    expect(saveButton).not.toBeDisabled();
  });

  it('should support accessibility and keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<UnsavedChangesExitDialog {...defaultProps} />);

    // Accessible labels
    expect(screen.getByText('SAVE AND LEAVE')).toBeInTheDocument();
    expect(screen.getByText('LEAVE WITHOUT SAVING')).toBeInTheDocument();
    expect(screen.getByText('STAY ON PAGE')).toBeInTheDocument();

    // Keyboard navigation - buttons present
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);

    // Enter key triggers action
    const saveButton = screen.getByText('SAVE AND LEAVE').closest('button')!;
    saveButton.focus();
    await user.keyboard('{Enter}');
    expect(mockOnSave).toHaveBeenCalledTimes(1);
  });

  it('should handle edge cases gracefully', () => {
    // Missing callbacks
    render(
      <UnsavedChangesExitDialog
        {...defaultProps}
        onSave={undefined as any}
        onLeave={undefined as any}
        onStay={undefined as any}
      />
    );

    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
  });
});
