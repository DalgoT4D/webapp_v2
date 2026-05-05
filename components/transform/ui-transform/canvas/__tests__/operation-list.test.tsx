/**
 * OperationList Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperationList } from '../panels/OperationList';

describe('OperationList', () => {
  const mockOnSelect = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders all operations in the list', () => {
    render(<OperationList onSelect={mockOnSelect} canChainInMiddle={true} />);
    expect(screen.getByTestId('operation-list')).toBeInTheDocument();
    // Spot-check a few known operations
    expect(screen.getByTestId('operation-aggregate')).toBeInTheDocument();
    expect(screen.getByTestId('operation-where')).toBeInTheDocument();
  });

  it('calls onSelect when an enabled operation is clicked', async () => {
    const user = userEvent.setup();
    render(<OperationList onSelect={mockOnSelect} canChainInMiddle={true} />);

    await user.click(screen.getByTestId('operation-aggregate'));
    expect(mockOnSelect).toHaveBeenCalledWith(expect.objectContaining({ slug: 'aggregate' }));
  });

  it('disables OPS_REQUIRING_TABLE_FIRST when canChainInMiddle is false', () => {
    render(<OperationList onSelect={mockOnSelect} canChainInMiddle={false} />);

    // castdatatypes and unionall require a table first
    expect(screen.getByTestId('operation-castdatatypes')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('operation-unionall')).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not call onSelect when a disabled operation is clicked', async () => {
    const user = userEvent.setup();
    render(<OperationList onSelect={mockOnSelect} canChainInMiddle={false} />);

    await user.click(screen.getByTestId('operation-castdatatypes'));
    expect(mockOnSelect).not.toHaveBeenCalled();
  });
});
