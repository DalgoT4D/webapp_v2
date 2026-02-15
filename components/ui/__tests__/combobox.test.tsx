import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox, highlightText, type ComboboxItem } from '../combobox';

const mockItems: ComboboxItem[] = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2' },
  { value: '3', label: 'Option 3' },
  { value: '4', label: 'Another Option' },
];

describe('Combobox - Single Mode', () => {
  it('renders and displays selected value correctly', () => {
    const { rerender } = render(
      <Combobox items={mockItems} value="" onValueChange={jest.fn()} placeholder="Select option" />
    );
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();

    rerender(<Combobox items={mockItems} value="1" onValueChange={jest.fn()} />);
    expect(screen.getByRole('combobox')).toHaveValue('Option 1');
  });

  it('handles search, filtering, and selection', async () => {
    const mockOnChange = jest.fn();
    const user = userEvent.setup();

    render(<Combobox items={mockItems} value="" onValueChange={mockOnChange} />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());

    // Test filtering
    await user.type(input, 'Another');
    await waitFor(() => {
      const options = screen.getByRole('listbox').querySelectorAll('[role="option"]');
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent('Another Option');
    });

    // Clear and select
    await user.clear(input);
    await user.click(input);
    await user.click(screen.getByText('Option 2'));

    expect(mockOnChange).toHaveBeenCalledWith('2');
  });

  it('handles keyboard navigation and selection', async () => {
    const mockOnChange = jest.fn();
    const user = userEvent.setup();

    render(<Combobox items={mockItems} value="" onValueChange={mockOnChange} />);

    const input = screen.getByRole('combobox');

    // Open with click, then use keyboard
    await user.click(input);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());

    // Navigate with arrow keys and select with Enter
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });

    // Test Escape closes
    await user.click(input);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('handles special states (loading, disabled, empty)', async () => {
    const user = userEvent.setup();

    // Loading state
    const { rerender } = render(
      <Combobox items={mockItems} value="" onValueChange={jest.fn()} loading={true} />
    );
    expect(screen.getByPlaceholderText('Loading...')).toBeInTheDocument();

    // Disabled state
    rerender(<Combobox items={mockItems} value="" onValueChange={jest.fn()} disabled={true} />);
    const input = screen.getByRole('combobox');
    expect(input).toBeDisabled();
    await user.click(input);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Empty results
    rerender(<Combobox items={mockItems} value="" onValueChange={jest.fn()} />);
    await user.click(input);
    await user.type(input, 'xyz');
    await waitFor(() => expect(screen.getByText('No results found.')).toBeInTheDocument());
  });

  it('handles edge cases (empty/undefined items, custom render)', async () => {
    const user = userEvent.setup();

    // Empty items
    const { rerender } = render(
      <Combobox items={[]} value="" onValueChange={jest.fn()} noItemsMessage="No items" />
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    // Undefined items (error handling)
    rerender(<Combobox items={undefined as any} value="" onValueChange={jest.fn()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    // Custom renderItem
    const customRender = (item: ComboboxItem) => (
      <div data-testid="custom-item">{item.label.toUpperCase()}</div>
    );
    rerender(
      <Combobox items={mockItems} value="" onValueChange={jest.fn()} renderItem={customRender} />
    );
    await user.click(screen.getByRole('combobox'));
    await waitFor(() => {
      expect(screen.getAllByTestId('custom-item')).toHaveLength(4);
      expect(screen.getAllByTestId('custom-item')[0]).toHaveTextContent('OPTION 1');
    });
  });

  it('handles chevron click to toggle dropdown', async () => {
    const user = userEvent.setup();
    render(<Combobox items={mockItems} value="" onValueChange={jest.fn()} />);

    const chevron = screen.getByTestId('combobox-chevron');

    // Click to open
    await user.click(chevron);
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());

    // Click to close
    await user.click(chevron);
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });
});

describe('Combobox - Multi Mode', () => {
  it('renders with placeholder and displays selected count', () => {
    const { rerender } = render(
      <Combobox
        mode="multi"
        items={mockItems}
        values={[]}
        onValuesChange={jest.fn()}
        placeholder="Select options"
      />
    );

    expect(screen.getByText('Select options')).toBeInTheDocument();

    rerender(
      <Combobox
        mode="multi"
        items={mockItems}
        values={['1', '2']}
        onValuesChange={jest.fn()}
        placeholder="Select options"
      />
    );
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('handles selection and deselection', async () => {
    const mockOnChange = jest.fn();
    const user = userEvent.setup();

    // Test selection
    const { rerender } = render(
      <Combobox mode="multi" items={mockItems} values={[]} onValuesChange={mockOnChange} />
    );
    await user.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
    await user.click(screen.getByText('Option 1'));
    expect(mockOnChange).toHaveBeenCalledWith(['1']);

    // Test deselection - render with value and deselect
    mockOnChange.mockClear();
    rerender(
      <Combobox mode="multi" items={mockItems} values={['1', '2']} onValuesChange={mockOnChange} />
    );

    // Deselect Option 1
    await user.click(screen.getByText('Option 1'));
    expect(mockOnChange).toHaveBeenCalledWith(['2']);
  });

  it('handles search and shows selected items with checkboxes', async () => {
    const user = userEvent.setup();
    render(
      <Combobox
        mode="multi"
        items={mockItems}
        values={['1', '3']}
        onValuesChange={jest.fn()}
        placeholder="Select options"
      />
    );

    await user.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getByTestId('combobox-multi-search')).toBeInTheDocument());

    // Test search
    const searchInput = screen.getByTestId('combobox-multi-search');
    await user.type(searchInput, 'Another');
    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent('Another Option');
    });

    // Clear search and check selected items
    await user.clear(searchInput);
    await waitFor(() => {
      const selectedOptions = screen
        .getAllByRole('option')
        .filter((opt) => opt.getAttribute('data-selected'));
      expect(selectedOptions).toHaveLength(2);
    });
  });

  it('handles edge cases and has proper accessibility', async () => {
    const user = userEvent.setup();

    // Empty values
    const { rerender } = render(
      <Combobox
        mode="multi"
        items={mockItems}
        values={[]}
        onValuesChange={jest.fn()}
        placeholder="Select"
      />
    );
    expect(screen.getByText('Select')).toBeInTheDocument();

    // Undefined values (error handling)
    rerender(
      <Combobox
        mode="multi"
        items={mockItems}
        values={undefined as any}
        onValuesChange={jest.fn()}
      />
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    // ARIA attributes
    rerender(<Combobox mode="multi" items={mockItems} values={[]} onValuesChange={jest.fn()} />);
    await user.click(screen.getByRole('combobox'));
    await waitFor(() => {
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-multiselectable', 'true');
    });
  });
});

describe('highlightText utility', () => {
  it('highlights text correctly and handles edge cases', () => {
    // Basic highlighting (case insensitive)
    const result1 = highlightText('Hello World', 'world');
    render(<div data-testid="test1">{result1}</div>);
    expect(screen.getByTestId('test1').querySelector('mark')).toHaveTextContent('World');

    // Empty query returns original text
    expect(highlightText('Hello World', '')).toBe('Hello World');

    // Null/undefined text
    expect(highlightText(null as any, 'test')).toBe('');
    expect(highlightText(undefined as any, 'test')).toBe('');

    // Regex special characters are escaped
    const result2 = highlightText('Cost: $100', '$100');
    render(<div data-testid="test2">{result2}</div>);
    expect(screen.getByTestId('test2').querySelector('mark')).toHaveTextContent('$100');

    // Handles errors gracefully - mock String.prototype.split to throw
    const originalSplit = String.prototype.split;
    String.prototype.split = jest.fn(() => {
      throw new Error('Split failed');
    });

    const result = highlightText('Test string', 'test');
    expect(result).toBe('Test string'); // Should fallback to original text

    // Restore original split
    String.prototype.split = originalSplit;
  });
});
