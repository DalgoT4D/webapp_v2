/**
 * Tests for SimpleTableConfiguration component
 * Tests table column selection with checkboxes and bulk actions
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SimpleTableConfiguration } from '../SimpleTableConfiguration';

describe('SimpleTableConfiguration', () => {
  const mockOnColumnsChange = jest.fn();

  const defaultProps = {
    availableColumns: ['id', 'name', 'email', 'age', 'city'],
    selectedColumns: ['name', 'email'],
    onColumnsChange: mockOnColumnsChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render complete UI and handle column selection', async () => {
    const user = userEvent.setup();
    const { container } = render(<SimpleTableConfiguration {...defaultProps} />);

    // UI elements
    expect(screen.getByText('Table Columns')).toBeInTheDocument();
    expect(screen.getByText(/selected 2 of 5 columns/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByText('age')).toBeInTheDocument();
    expect(screen.getByText('city')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(5);

    // Layout
    expect(container.querySelector('.grid.grid-cols-2')).toBeInTheDocument();
    expect(container.querySelector('.max-h-60.overflow-y-auto')).toBeInTheDocument();
    expect(container.querySelector('.flex.gap-2')).toBeInTheDocument();

    // Checked state
    const nameCheckbox = screen.getByRole('checkbox', { name: /name/i });
    const emailCheckbox = screen.getByRole('checkbox', { name: /email/i });
    expect(nameCheckbox).toBeChecked();
    expect(emailCheckbox).toBeChecked();
    const idCheckbox = screen.getByRole('checkbox', { name: /^id$/i });
    const ageCheckbox = screen.getByRole('checkbox', { name: /age/i });
    const cityCheckbox = screen.getByRole('checkbox', { name: /city/i });
    expect(idCheckbox).not.toBeChecked();
    expect(ageCheckbox).not.toBeChecked();
    expect(cityCheckbox).not.toBeChecked();

    // Selection interactions
    await user.click(ageCheckbox);
    expect(mockOnColumnsChange).toHaveBeenCalledWith(['name', 'email', 'age']);
    jest.clearAllMocks();
    await user.click(nameCheckbox);
    expect(mockOnColumnsChange).toHaveBeenCalledWith(['email']);
    jest.clearAllMocks();
    await user.click(idCheckbox);
    expect(mockOnColumnsChange).toHaveBeenCalledWith(['name', 'email', 'id']);

    // Label click
    jest.clearAllMocks();
    const ageLabel = screen.getByText('age');
    await user.click(ageLabel);
    expect(mockOnColumnsChange).toHaveBeenCalledWith(['name', 'email', 'age']);

    // Rapid clicks
    jest.clearAllMocks();
    await user.click(ageCheckbox);
    await user.click(ageCheckbox);
    await user.click(ageCheckbox);
    expect(mockOnColumnsChange).toHaveBeenCalledTimes(3);
  });

  it('should handle bulk actions and column count display', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SimpleTableConfiguration {...defaultProps} />);

    // Initial count
    expect(screen.getByText(/selected 2 of 5 columns/i)).toBeInTheDocument();

    // Select All
    const selectAllButton = screen.getByRole('button', { name: /select all/i });
    await user.click(selectAllButton);
    expect(mockOnColumnsChange).toHaveBeenCalledWith(['id', 'name', 'email', 'age', 'city']);

    // Clear All
    jest.clearAllMocks();
    const clearAllButton = screen.getByRole('button', { name: /clear all/i });
    await user.click(clearAllButton);
    expect(mockOnColumnsChange).toHaveBeenCalledWith([]);

    // All selected count
    rerender(
      <SimpleTableConfiguration
        {...defaultProps}
        selectedColumns={['id', 'name', 'email', 'age', 'city']}
      />
    );
    expect(screen.getByText(/selected 5 of 5 columns/i)).toBeInTheDocument();
    await user.click(selectAllButton);
    expect(mockOnColumnsChange).toHaveBeenCalledWith(['id', 'name', 'email', 'age', 'city']);

    // None selected count
    jest.clearAllMocks();
    rerender(<SimpleTableConfiguration {...defaultProps} selectedColumns={[]} />);
    expect(screen.getByText(/selected 0 of 5 columns/i)).toBeInTheDocument();
    await user.click(clearAllButton);
    expect(mockOnColumnsChange).toHaveBeenCalledWith([]);

    // Dynamic count
    rerender(
      <SimpleTableConfiguration {...defaultProps} selectedColumns={['name', 'email', 'age']} />
    );
    expect(screen.getByText(/selected 3 of 5 columns/i)).toBeInTheDocument();
  });

  it('should handle edge cases correctly', () => {
    // Empty columns
    const { rerender } = render(
      <SimpleTableConfiguration {...defaultProps} availableColumns={[]} selectedColumns={[]} />
    );
    expect(screen.getByText(/selected 0 of 0 columns/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    // Single column
    rerender(
      <SimpleTableConfiguration
        {...defaultProps}
        availableColumns={['name']}
        selectedColumns={['name']}
      />
    );
    expect(screen.getByText(/selected 1 of 1 columns/i)).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox').length).toBe(1);

    // Many columns
    const manyColumns = Array.from({ length: 50 }, (_, i) => `column_${i}`);
    rerender(
      <SimpleTableConfiguration
        {...defaultProps}
        availableColumns={manyColumns}
        selectedColumns={[]}
      />
    );
    expect(screen.getByText(/selected 0 of 50 columns/i)).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox').length).toBe(50);

    // Special characters
    rerender(
      <SimpleTableConfiguration
        {...defaultProps}
        availableColumns={['user_name', 'email@domain', 'created-at']}
        selectedColumns={[]}
      />
    );
    expect(screen.getByText('user_name')).toBeInTheDocument();
    expect(screen.getByText('email@domain')).toBeInTheDocument();
    expect(screen.getByText('created-at')).toBeInTheDocument();
  });

  it('should meet accessibility requirements', async () => {
    const user = userEvent.setup();
    render(<SimpleTableConfiguration {...defaultProps} />);

    // Labels
    const nameLabel = screen.getByText('name');
    expect(nameLabel).toHaveAttribute('for', 'name');
    expect(nameLabel).toHaveAttribute('title', 'name');
    expect(nameLabel).toHaveClass('cursor-pointer');

    // Keyboard navigation
    const ageCheckbox = screen.getByRole('checkbox', { name: /age/i });
    ageCheckbox.focus();
    expect(ageCheckbox).toHaveFocus();
    await user.keyboard(' ');
    expect(mockOnColumnsChange).toHaveBeenCalled();
  });
});
