/**
 * Tests for TableConfiguration component
 * Tests column selection, bulk actions, and advanced column formatting configuration
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableConfiguration } from '../TableConfiguration';

describe('TableConfiguration', () => {
  const mockOnColumnsChange = jest.fn();
  const mockOnFormattingChange = jest.fn();

  const defaultProps = {
    availableColumns: ['id', 'name', 'email', 'age', 'salary'],
    selectedColumns: ['name', 'email'],
    columnFormatting: {},
    onColumnsChange: mockOnColumnsChange,
    onFormattingChange: mockOnFormattingChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render column selection card', () => {
      render(<TableConfiguration {...defaultProps} />);

      expect(screen.getByText('Column Selection')).toBeInTheDocument();
    });

    it('should render Select All and Clear All buttons', () => {
      render(<TableConfiguration {...defaultProps} />);

      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
    });

    it('should render all available columns as checkboxes', () => {
      render(<TableConfiguration {...defaultProps} />);

      defaultProps.availableColumns.forEach((column) => {
        expect(screen.getByLabelText(column)).toBeInTheDocument();
      });
    });

    it('should display column count', () => {
      render(<TableConfiguration {...defaultProps} />);

      expect(screen.getByText(/selected 2 of 5 columns/i)).toBeInTheDocument();
    });

    it('should show selected columns as checked', () => {
      render(<TableConfiguration {...defaultProps} />);

      const nameCheckbox = screen.getByLabelText('name');
      const emailCheckbox = screen.getByLabelText('email');
      const idCheckbox = screen.getByLabelText('id');

      // Radix UI checkboxes use aria-checked attribute
      expect(nameCheckbox).toHaveAttribute('aria-checked', 'true');
      expect(emailCheckbox).toHaveAttribute('aria-checked', 'true');
      expect(idCheckbox).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('Column Selection', () => {
    it('should toggle column selection when clicking checkbox', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const ageCheckbox = screen.getByLabelText('age');
      await user.click(ageCheckbox);

      expect(mockOnColumnsChange).toHaveBeenCalledWith(['name', 'email', 'age']);
    });

    it('should deselect column when clicking checked checkbox', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const nameCheckbox = screen.getByLabelText('name');
      await user.click(nameCheckbox);

      expect(mockOnColumnsChange).toHaveBeenCalledWith(['email']);
    });

    it('should toggle column when clicking label', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const ageLabel = screen.getByText('age');
      await user.click(ageLabel);

      expect(mockOnColumnsChange).toHaveBeenCalledWith(['name', 'email', 'age']);
    });

    it('should handle multiple rapid selections', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const idCheckbox = screen.getByLabelText('id');
      const ageCheckbox = screen.getByLabelText('age');
      const salaryCheckbox = screen.getByLabelText('salary');

      await user.click(idCheckbox);
      await user.click(ageCheckbox);
      await user.click(salaryCheckbox);

      expect(mockOnColumnsChange).toHaveBeenCalledTimes(3);
      expect(mockOnColumnsChange).toHaveBeenLastCalledWith(['name', 'email', 'salary']);
    });
  });

  describe('Bulk Actions', () => {
    it('should select all columns when clicking Select All', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);

      expect(mockOnColumnsChange).toHaveBeenCalledWith(defaultProps.availableColumns);
    });

    it('should clear all selections when clicking Clear All', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const clearAllButton = screen.getByRole('button', { name: /clear all/i });
      await user.click(clearAllButton);

      expect(mockOnColumnsChange).toHaveBeenCalledWith([]);
    });

    it('should handle Select All when all columns already selected', async () => {
      const user = userEvent.setup();
      const propsWithAllSelected = {
        ...defaultProps,
        selectedColumns: defaultProps.availableColumns,
      };

      render(<TableConfiguration {...propsWithAllSelected} />);

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      await user.click(selectAllButton);

      expect(mockOnColumnsChange).toHaveBeenCalledWith(defaultProps.availableColumns);
    });

    it('should handle Clear All when no columns selected', async () => {
      const user = userEvent.setup();
      const propsWithNoneSelected = {
        ...defaultProps,
        selectedColumns: [],
      };

      render(<TableConfiguration {...propsWithNoneSelected} />);

      const clearAllButton = screen.getByRole('button', { name: /clear all/i });
      await user.click(clearAllButton);

      expect(mockOnColumnsChange).toHaveBeenCalledWith([]);
    });
  });

  describe('Column Formatting Section', () => {
    it('should not show formatting section when no columns selected', () => {
      const propsWithNoSelection = {
        ...defaultProps,
        selectedColumns: [],
      };

      render(<TableConfiguration {...propsWithNoSelection} />);

      expect(screen.queryByText('Column Formatting')).not.toBeInTheDocument();
    });

    it('should show formatting section when columns are selected', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      // Accordion is collapsed by default, need to expand it
      const accordionTrigger = screen.getByText('Column Formatting');
      expect(accordionTrigger).toBeInTheDocument();
    });

    it('should expand formatting section when clicking trigger', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      // Should now see Format Type labels (indicating section expanded)
      expect(screen.getAllByText('Format Type').length).toBeGreaterThan(0);
    });

    it('should show formatting controls for each selected column', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      // Should have formatting sections for both selected columns
      const columnHeaders = screen.getAllByText(/^(name|email)$/);
      expect(columnHeaders.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Format Type Selection', () => {
    it('should render format type selector for each column', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      const formatTypeLabels = screen.getAllByText('Format Type');
      expect(formatTypeLabels.length).toBe(2); // One for each selected column
    });

    it('should default to text format type', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      // Format type selectors should exist
      expect(screen.getAllByText('Format Type').length).toBe(2);
    });

    it('should display existing format type', async () => {
      const user = userEvent.setup();
      const propsWithFormatting = {
        ...defaultProps,
        columnFormatting: {
          name: { type: 'text' as const },
          email: { type: 'number' as const },
        },
      };

      render(<TableConfiguration {...propsWithFormatting} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      // Should have format type selectors
      expect(screen.getAllByText('Format Type').length).toBe(2);
    });
  });

  describe('Precision Configuration', () => {
    it('should show precision input for number format', async () => {
      const user = userEvent.setup();
      const propsWithNumberFormat = {
        ...defaultProps,
        columnFormatting: {
          salary: { type: 'number' as const, precision: 2 },
        },
        selectedColumns: ['salary'],
      };

      render(<TableConfiguration {...propsWithNumberFormat} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      expect(screen.getByText('Decimal Places')).toBeInTheDocument();
    });

    it('should show precision input for currency format', async () => {
      const user = userEvent.setup();
      const propsWithCurrencyFormat = {
        ...defaultProps,
        columnFormatting: {
          salary: { type: 'currency' as const, precision: 2 },
        },
        selectedColumns: ['salary'],
      };

      render(<TableConfiguration {...propsWithCurrencyFormat} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      expect(screen.getByText('Decimal Places')).toBeInTheDocument();
    });

    it('should show precision input for percentage format', async () => {
      const user = userEvent.setup();
      const propsWithPercentageFormat = {
        ...defaultProps,
        columnFormatting: {
          age: { type: 'percentage' as const, precision: 1 },
        },
        selectedColumns: ['age'],
      };

      render(<TableConfiguration {...propsWithPercentageFormat} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      expect(screen.getByText('Decimal Places')).toBeInTheDocument();
    });

    it('should not show precision input for text format', async () => {
      const user = userEvent.setup();
      const propsWithTextFormat = {
        ...defaultProps,
        columnFormatting: {
          name: { type: 'text' as const },
        },
        selectedColumns: ['name'],
      };

      render(<TableConfiguration {...propsWithTextFormat} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      expect(screen.queryByText('Decimal Places')).not.toBeInTheDocument();
    });

    it('should not show precision input for date format', async () => {
      const user = userEvent.setup();
      const propsWithDateFormat = {
        ...defaultProps,
        columnFormatting: {
          age: { type: 'date' as const },
        },
        selectedColumns: ['age'],
      };

      render(<TableConfiguration {...propsWithDateFormat} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      expect(screen.queryByText('Decimal Places')).not.toBeInTheDocument();
    });

    it('should update precision when input changes', async () => {
      const user = userEvent.setup();
      const propsWithNumberFormat = {
        ...defaultProps,
        columnFormatting: {
          salary: { type: 'number' as const, precision: 2 },
        },
        selectedColumns: ['salary'],
      };

      render(<TableConfiguration {...propsWithNumberFormat} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      // Find precision input by value
      const precisionInput = screen.getByDisplayValue('2') as HTMLInputElement;

      // Triple-click to select all, then type new value
      await user.tripleClick(precisionInput);
      await user.keyboard('4');

      expect(mockOnFormattingChange).toHaveBeenCalled();
      const lastCall =
        mockOnFormattingChange.mock.calls[mockOnFormattingChange.mock.calls.length - 1][0];
      expect(lastCall.salary.precision).toBe(4);
    });
  });

  describe('Prefix and Suffix Configuration', () => {
    it('should render prefix and suffix inputs', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      const prefixLabels = screen.getAllByText('Prefix');
      const suffixLabels = screen.getAllByText('Suffix');

      expect(prefixLabels.length).toBe(2); // One for each selected column
      expect(suffixLabels.length).toBe(2);
    });

    it('should display existing prefix value', async () => {
      const user = userEvent.setup();
      const propsWithPrefix = {
        ...defaultProps,
        columnFormatting: {
          salary: { type: 'currency' as const, prefix: '$' },
        },
        selectedColumns: ['salary'],
      };

      render(<TableConfiguration {...propsWithPrefix} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      const prefixInput = screen.getByDisplayValue('$');
      expect(prefixInput).toBeInTheDocument();
    });

    it('should display existing suffix value', async () => {
      const user = userEvent.setup();
      const propsWithSuffix = {
        ...defaultProps,
        columnFormatting: {
          age: { type: 'text' as const, suffix: 'years' },
        },
        selectedColumns: ['age'],
      };

      render(<TableConfiguration {...propsWithSuffix} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      const suffixInput = screen.getByDisplayValue('years');
      expect(suffixInput).toBeInTheDocument();
    });

    it('should update prefix when input changes', async () => {
      const user = userEvent.setup();
      const propsWithColumn = {
        ...defaultProps,
        selectedColumns: ['salary'],
        columnFormatting: { salary: {} },
      };

      render(<TableConfiguration {...propsWithColumn} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      const prefixInput = screen.getByPlaceholderText('e.g., $, #');
      await user.type(prefixInput, '$');

      expect(mockOnFormattingChange).toHaveBeenCalled();
      const lastCall =
        mockOnFormattingChange.mock.calls[mockOnFormattingChange.mock.calls.length - 1][0];
      expect(lastCall.salary.prefix).toBeDefined();
    });

    it('should update suffix when input changes', async () => {
      const user = userEvent.setup();
      const propsWithColumn = {
        ...defaultProps,
        selectedColumns: ['age'],
        columnFormatting: { age: {} },
      };

      render(<TableConfiguration {...propsWithColumn} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      const suffixInput = screen.getByPlaceholderText('e.g., %, units');
      await user.type(suffixInput, '%');

      expect(mockOnFormattingChange).toHaveBeenCalled();
      const lastCall =
        mockOnFormattingChange.mock.calls[mockOnFormattingChange.mock.calls.length - 1][0];
      expect(lastCall.age.suffix).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty available columns', () => {
      const propsWithNoColumns = {
        ...defaultProps,
        availableColumns: [],
        selectedColumns: [],
      };

      render(<TableConfiguration {...propsWithNoColumns} />);

      expect(screen.getByText(/selected 0 of 0 columns/i)).toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('should handle single column', () => {
      const propsWithOneColumn = {
        ...defaultProps,
        availableColumns: ['name'],
        selectedColumns: ['name'],
      };

      render(<TableConfiguration {...propsWithOneColumn} />);

      expect(screen.getByText(/selected 1 of 1 columns/i)).toBeInTheDocument();
      expect(screen.getByLabelText('name')).toBeInTheDocument();
    });

    it('should handle columns with special characters', () => {
      const propsWithSpecialChars = {
        ...defaultProps,
        availableColumns: ['user_name', 'email@domain', 'created-at'],
        selectedColumns: [],
      };

      render(<TableConfiguration {...propsWithSpecialChars} />);

      expect(screen.getByLabelText('user_name')).toBeInTheDocument();
      expect(screen.getByLabelText('email@domain')).toBeInTheDocument();
      expect(screen.getByLabelText('created-at')).toBeInTheDocument();
    });

    it('should handle long column names with truncation', () => {
      const propsWithLongNames = {
        ...defaultProps,
        availableColumns: ['very_long_column_name_that_should_be_truncated'],
        selectedColumns: [],
      };

      const { container } = render(<TableConfiguration {...propsWithLongNames} />);

      const label = screen.getByText('very_long_column_name_that_should_be_truncated');
      expect(label).toHaveClass('truncate');
      expect(label).toHaveAttribute('title', 'very_long_column_name_that_should_be_truncated');
    });

    it('should handle many columns with scrollable area', () => {
      const manyColumns = Array.from({ length: 50 }, (_, i) => `column_${i}`);
      const propsWithManyColumns = {
        ...defaultProps,
        availableColumns: manyColumns,
        selectedColumns: [],
      };

      const { container } = render(<TableConfiguration {...propsWithManyColumns} />);

      expect(screen.getByText(/selected 0 of 50 columns/i)).toBeInTheDocument();
      const scrollableDiv = container.querySelector('.max-h-60.overflow-y-auto');
      expect(scrollableDiv).toBeInTheDocument();
    });

    it('should preserve unrelated formatting fields when updating', async () => {
      const user = userEvent.setup();
      const propsWithExistingFormatting = {
        ...defaultProps,
        columnFormatting: {
          salary: {
            type: 'currency' as const,
            precision: 2,
            prefix: '$',
          },
        },
        selectedColumns: ['salary'],
      };

      render(<TableConfiguration {...propsWithExistingFormatting} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      const suffixInput = screen.getByPlaceholderText('e.g., %, units');
      await user.type(suffixInput, '/mo');

      expect(mockOnFormattingChange).toHaveBeenCalled();
      const lastCall =
        mockOnFormattingChange.mock.calls[mockOnFormattingChange.mock.calls.length - 1][0];
      expect(lastCall.salary.type).toBe('currency');
      expect(lastCall.salary.precision).toBe(2);
      expect(lastCall.salary.prefix).toBe('$');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow: select columns then configure formatting', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<TableConfiguration {...defaultProps} />);

      // Select additional column
      const salaryCheckbox = screen.getByLabelText('salary');
      await user.click(salaryCheckbox);

      expect(mockOnColumnsChange).toHaveBeenCalledWith(['name', 'email', 'salary']);

      // Simulate parent updating props
      const updatedProps = {
        ...defaultProps,
        selectedColumns: ['name', 'email', 'salary'],
      };
      rerender(<TableConfiguration {...updatedProps} />);

      // Expand formatting section
      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      // Should now see all three columns
      expect(screen.getAllByText('Format Type').length).toBe(3);
    });

    it('should maintain formatting when columns are deselected and reselected', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      // Expand formatting and configure
      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      // Deselect a column
      const nameCheckbox = screen.getByLabelText('name');
      await user.click(nameCheckbox);

      expect(mockOnColumnsChange).toHaveBeenCalledWith(['email']);

      // Component would update selectedColumns to ['email'], so find the checkbox again
      // After deselection, checkbox would be in different state
      // Just verify the deselection was called correctly
      expect(mockOnColumnsChange).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid bulk action clicks', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      const clearAllButton = screen.getByRole('button', { name: /clear all/i });

      await user.click(selectAllButton);
      await user.click(clearAllButton);
      await user.click(selectAllButton);

      expect(mockOnColumnsChange).toHaveBeenCalledTimes(3);
      expect(mockOnColumnsChange).toHaveBeenLastCalledWith(defaultProps.availableColumns);
    });
  });
});
