import { render, screen, fireEvent } from '@testing-library/react';
import { ConditionalFormattingSection } from '../ConditionalFormattingSection';
import type { ConditionalFormattingRule } from '../types';

describe('ConditionalFormattingSection', () => {
  const defaultProps = {
    rules: [] as ConditionalFormattingRule[],
    onChange: jest.fn(),
    availableColumns: ['revenue', 'count', 'amount'],
  };

  beforeEach(() => {
    defaultProps.onChange.mockClear();
  });

  it('renders section heading', () => {
    render(<ConditionalFormattingSection {...defaultProps} />);
    expect(screen.getByText('Conditional Formatting')).toBeInTheDocument();
  });

  it('renders add rule button', () => {
    render(<ConditionalFormattingSection {...defaultProps} />);
    expect(screen.getByTestId('add-formatting-rule-btn')).toBeInTheDocument();
  });

  it('adds a new numeric rule with defaults when first column is numeric', () => {
    render(<ConditionalFormattingSection {...defaultProps} />);
    fireEvent.click(screen.getByTestId('add-formatting-rule-btn'));
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      {
        type: 'numeric',
        column: 'revenue',
        operator: '>',
        value: 0,
        color: '#C8E6C9',
      },
    ]);
  });

  it('adds a new text rule with defaults when first column is text', () => {
    render(
      <ConditionalFormattingSection
        {...defaultProps}
        availableColumns={['status', 'category']}
        columnTypeMap={{ status: 'text', category: 'text' }}
      />
    );
    fireEvent.click(screen.getByTestId('add-formatting-rule-btn'));
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      {
        type: 'text',
        column: 'status',
        operator: '==',
        value: '',
        color: '#C8E6C9',
      },
    ]);
  });

  it('renders existing rules', () => {
    const rules: ConditionalFormattingRule[] = [
      { type: 'numeric', column: 'revenue', operator: '>', value: 10000, color: '#C8E6C9' },
      { type: 'numeric', column: 'count', operator: '<', value: 5, color: '#FFCDD2' },
    ];
    render(<ConditionalFormattingSection {...defaultProps} rules={rules} />);
    const deleteButtons = screen.getAllByTestId(/^delete-rule-/);
    expect(deleteButtons).toHaveLength(2);
  });

  it('removes a rule when delete button is clicked', () => {
    const rules: ConditionalFormattingRule[] = [
      { type: 'numeric', column: 'revenue', operator: '>', value: 10000, color: '#C8E6C9' },
      { type: 'numeric', column: 'count', operator: '<', value: 5, color: '#FFCDD2' },
    ];
    render(<ConditionalFormattingSection {...defaultProps} rules={rules} />);
    fireEvent.click(screen.getByTestId('delete-rule-0'));
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      { type: 'numeric', column: 'count', operator: '<', value: 5, color: '#FFCDD2' },
    ]);
  });

  it('shows empty state when no columns available', () => {
    render(<ConditionalFormattingSection {...defaultProps} availableColumns={[]} />);
    expect(screen.getByText(/No columns available/)).toBeInTheDocument();
  });

  it('shows only == and != operators for text columns', () => {
    const rules: ConditionalFormattingRule[] = [
      { type: 'text', column: 'status', operator: '==', value: 'active', color: '#C8E6C9' },
    ];
    render(
      <ConditionalFormattingSection
        {...defaultProps}
        rules={rules}
        availableColumns={['status']}
        columnTypeMap={{ status: 'text' }}
      />
    );
    // Numeric-only operators should not be present
    expect(screen.queryByText(/Greater than/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Less than/)).not.toBeInTheDocument();
  });

  it('renders text input with placeholder for text column rules', () => {
    const rules: ConditionalFormattingRule[] = [
      { type: 'text', column: 'status', operator: '==', value: 'active', color: '#C8E6C9' },
    ];
    render(
      <ConditionalFormattingSection
        {...defaultProps}
        rules={rules}
        availableColumns={['status']}
        columnTypeMap={{ status: 'text' }}
      />
    );
    const input = screen.getByTestId('rule-value-0');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('placeholder', 'e.g. active');
  });

  it('renders number input for numeric column rules', () => {
    const rules: ConditionalFormattingRule[] = [
      { type: 'numeric', column: 'revenue', operator: '>', value: 1000, color: '#C8E6C9' },
    ];
    render(<ConditionalFormattingSection {...defaultProps} rules={rules} />);
    const input = screen.getByTestId('rule-value-0');
    expect(input).toHaveAttribute('type', 'number');
  });
});
