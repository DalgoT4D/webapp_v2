/**
 * CreateTableOrAddFunction Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { TestWrapper } from '@/test-utils/render';
import userEvent from '@testing-library/user-event';
import { CreateTableOrAddFunction } from '../panels/CreateTableOrAddFunction';

describe('CreateTableOrAddFunction', () => {
  const mockOnCreateTable = jest.fn();
  const mockOnAddFunction = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('hides Add Function button when showAddFunction is false', () => {
    render(
      <CreateTableOrAddFunction
        onCreateTable={mockOnCreateTable}
        onAddFunction={mockOnAddFunction}
        showAddFunction={false}
      />,
      { wrapper: TestWrapper }
    );

    expect(screen.getByTestId('create-table-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('add-function-btn')).not.toBeInTheDocument();
  });

  it('calls correct callbacks when each button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <CreateTableOrAddFunction
        onCreateTable={mockOnCreateTable}
        onAddFunction={mockOnAddFunction}
      />,
      { wrapper: TestWrapper }
    );

    await user.click(screen.getByTestId('create-table-btn'));
    expect(mockOnCreateTable).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('add-function-btn'));
    expect(mockOnAddFunction).toHaveBeenCalledTimes(1);
  });
});
