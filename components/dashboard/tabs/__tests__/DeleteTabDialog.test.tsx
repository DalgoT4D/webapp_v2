import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteTabDialog } from '../DeleteTabDialog';

describe('DeleteTabDialog', () => {
  const mockOnConfirm = jest.fn();
  const mockOnOpenChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dialog when open', () => {
    render(
      <DeleteTabDialog open={true} onOpenChange={mockOnOpenChange} onConfirm={mockOnConfirm} />
    );
    expect(screen.getByTestId('delete-tab-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Tab')).toBeInTheDocument();
  });

  it('does not render dialog when closed', () => {
    render(
      <DeleteTabDialog open={false} onOpenChange={mockOnOpenChange} onConfirm={mockOnConfirm} />
    );
    expect(screen.queryByTestId('delete-tab-dialog')).not.toBeInTheDocument();
  });

  it('calls onConfirm when DELETE is clicked', async () => {
    const user = userEvent.setup();
    render(
      <DeleteTabDialog open={true} onOpenChange={mockOnOpenChange} onConfirm={mockOnConfirm} />
    );
    await user.click(screen.getByTestId('delete-tab-confirm-btn'));
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange(false) when CANCEL is clicked', async () => {
    const user = userEvent.setup();
    render(
      <DeleteTabDialog open={true} onOpenChange={mockOnOpenChange} onConfirm={mockOnConfirm} />
    );
    await user.click(screen.getByTestId('delete-tab-cancel-btn'));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });
});
