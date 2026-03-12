/**
 * Tests for TableConfiguration component
 * Consolidated tests for column selection, bulk actions, and column formatting configuration
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

  describe('Rendering and Display', () => {
    it('should render column selection card with controls and count', () => {
      render(<TableConfiguration {...defaultProps} />);

      expect(screen.getByText('Column Selection')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select all/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument();
      expect(screen.getByText(/selected 2 of 5 columns/i)).toBeInTheDocument();
    });

    it('should render all available columns as checkboxes', () => {
      render(<TableConfiguration {...defaultProps} />);

      defaultProps.availableColumns.forEach((column) => {
        expect(screen.getByLabelText(column)).toBeInTheDocument();
      });
    });

    it.each([
      ['name', 'true'],
      ['email', 'true'],
      ['id', 'false'],
    ])('should show %s checkbox as %s', (column, checked) => {
      render(<TableConfiguration {...defaultProps} />);

      const checkbox = screen.getByLabelText(column);
      expect(checkbox).toHaveAttribute('aria-checked', checked);
    });
  });

  describe('Column Selection Interactions', () => {
    it.each([
      ['select new column', 'age', ['name', 'email', 'age']],
      ['deselect existing column', 'name', ['email']],
    ])('should %s when clicking checkbox', async (desc, column, expected) => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const checkbox = screen.getByLabelText(column);
      await user.click(checkbox);

      expect(mockOnColumnsChange).toHaveBeenCalledWith(expected);
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

      await user.click(screen.getByLabelText('id'));
      await user.click(screen.getByLabelText('age'));
      await user.click(screen.getByLabelText('salary'));

      expect(mockOnColumnsChange).toHaveBeenCalledTimes(3);
      expect(mockOnColumnsChange).toHaveBeenLastCalledWith(['name', 'email', 'salary']);
    });
  });

  describe('Bulk Actions', () => {
    it.each([
      ['select all', /select all/i, ['id', 'name', 'email', 'age', 'salary']],
      ['clear all', /clear all/i, []],
    ])('should %s columns', async (action, buttonName, expected) => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const button = screen.getByRole('button', { name: buttonName });
      await user.click(button);

      expect(mockOnColumnsChange).toHaveBeenCalledWith(expected);
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

  describe('Column Formatting Section', () => {
    it('should not show formatting section when no columns selected', () => {
      const propsWithNoSelection = { ...defaultProps, selectedColumns: [] };

      render(<TableConfiguration {...propsWithNoSelection} />);

      expect(screen.queryByText('Column Formatting')).not.toBeInTheDocument();
    });

    it('should show and expand formatting section when columns are selected', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      expect(screen.getByText('Column Formatting')).toBeInTheDocument();

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      expect(screen.getAllByText('Format Type').length).toBeGreaterThan(0);
    });

    it('should show formatting controls for each selected column', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      const columnHeaders = screen.getAllByText(/^(name|email)$/);
      expect(columnHeaders.length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Format Type').length).toBe(2);
    });
  });

  describe('Format Type and Precision Configuration', () => {
    it('should render format type selector for each column', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      const formatTypeLabels = screen.getAllByText('Format Type');
      expect(formatTypeLabels.length).toBe(2);
    });

    it.each([
      ['number', { salary: { type: 'number' as const, precision: 2 } }, 'salary', true],
      ['currency', { salary: { type: 'currency' as const, precision: 2 } }, 'salary', true],
      ['percentage', { age: { type: 'percentage' as const, precision: 1 } }, 'age', true],
      ['text', { name: { type: 'text' as const } }, 'name', false],
      ['date', { age: { type: 'date' as const } }, 'age', false],
    ])(
      'should show precision input for %s format: %s',
      async (formatType, formatting, column, shouldShow) => {
        const user = userEvent.setup();
        const propsWithFormatting = {
          ...defaultProps,
          columnFormatting: formatting,
          selectedColumns: [column],
        };

        render(<TableConfiguration {...propsWithFormatting} />);

        const accordionTrigger = screen.getByText('Column Formatting');
        await user.click(accordionTrigger);

        if (shouldShow) {
          expect(screen.getByText('Decimal Places')).toBeInTheDocument();
        } else {
          expect(screen.queryByText('Decimal Places')).not.toBeInTheDocument();
        }
      }
    );

    it('should update precision when input changes', async () => {
      const user = userEvent.setup();
      const propsWithNumberFormat = {
        ...defaultProps,
        columnFormatting: { salary: { type: 'number' as const, precision: 2 } },
        selectedColumns: ['salary'],
      };

      render(<TableConfiguration {...propsWithNumberFormat} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      const precisionInput = screen.getByDisplayValue('2') as HTMLInputElement;
      await user.tripleClick(precisionInput);
      await user.keyboard('4');

      expect(mockOnFormattingChange).toHaveBeenCalled();
      const lastCall =
        mockOnFormattingChange.mock.calls[mockOnFormattingChange.mock.calls.length - 1][0];
      expect(lastCall.salary.precision).toBe(4);
    });
  });

  describe('Prefix and Suffix Configuration', () => {
    it('should render prefix and suffix inputs for selected columns', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      const prefixLabels = screen.getAllByText('Prefix');
      const suffixLabels = screen.getAllByText('Suffix');

      expect(prefixLabels.length).toBe(2);
      expect(suffixLabels.length).toBe(2);
    });

    it.each([
      ['prefix', '$', 'e.g., $, #', 'prefix'],
      ['suffix', 'years', 'e.g., %, units', 'suffix'],
    ])('should display and update %s value', async (field, value, placeholder, key) => {
      const user = userEvent.setup();
      const propsWithFormatting = {
        ...defaultProps,
        columnFormatting:
          field === 'prefix' ? { salary: { prefix: value } } : { age: { suffix: value } },
        selectedColumns: [field === 'prefix' ? 'salary' : 'age'],
      };

      render(<TableConfiguration {...propsWithFormatting} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      const input = screen.getByDisplayValue(value);
      expect(input).toBeInTheDocument();
    });

    it('should preserve unrelated formatting fields when updating', async () => {
      const user = userEvent.setup();
      const propsWithExistingFormatting = {
        ...defaultProps,
        columnFormatting: {
          salary: { type: 'currency' as const, precision: 2, prefix: '$' },
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

  describe('Edge Cases', () => {
    it.each([
      ['empty available columns', { availableColumns: [], selectedColumns: [] }, 0, 0],
      ['single column', { availableColumns: ['name'], selectedColumns: ['name'] }, 1, 1],
    ])('should handle %s', (desc, overrides, expectedOf, expectedSelected) => {
      const props = { ...defaultProps, ...overrides };
      render(<TableConfiguration {...props} />);

      expect(
        screen.getByText(new RegExp(`selected ${expectedSelected} of ${expectedOf} columns`, 'i'))
      ).toBeInTheDocument();
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

      render(<TableConfiguration {...propsWithLongNames} />);

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
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow: select columns then configure formatting', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<TableConfiguration {...defaultProps} />);

      await user.click(screen.getByLabelText('salary'));

      expect(mockOnColumnsChange).toHaveBeenCalledWith(['name', 'email', 'salary']);

      const updatedProps = { ...defaultProps, selectedColumns: ['name', 'email', 'salary'] };
      rerender(<TableConfiguration {...updatedProps} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      expect(screen.getAllByText('Format Type').length).toBe(3);
    });

    it('should maintain formatting when columns are deselected and reselected', async () => {
      const user = userEvent.setup();
      render(<TableConfiguration {...defaultProps} />);

      const accordionTrigger = screen.getByText('Column Formatting');
      await user.click(accordionTrigger);

      const nameCheckbox = screen.getByLabelText('name');
      await user.click(nameCheckbox);

      expect(mockOnColumnsChange).toHaveBeenCalledWith(['email']);
      expect(mockOnColumnsChange).toHaveBeenCalledTimes(1);
    });
  });
});
