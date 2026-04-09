import { render, screen, fireEvent } from '@testing-library/react';
import { ConditionalFormattingSection } from '../ConditionalFormattingSection';

describe('ConditionalFormattingSection', () => {
  const defaultProps = {
    rules: [],
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

  it('adds a new rule with defaults when add button is clicked', () => {
    render(<ConditionalFormattingSection {...defaultProps} />);
    fireEvent.click(screen.getByTestId('add-formatting-rule-btn'));
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      {
        column: 'revenue',
        operator: '>',
        value: 0,
        color: '#C8E6C9',
      },
    ]);
  });

  it('renders existing rules', () => {
    const rules = [
      { column: 'revenue', operator: '>' as const, value: 10000, color: '#C8E6C9' },
      { column: 'count', operator: '<' as const, value: 5, color: '#FFCDD2' },
    ];
    render(<ConditionalFormattingSection {...defaultProps} rules={rules} />);
    const deleteButtons = screen.getAllByTestId(/^delete-rule-/);
    expect(deleteButtons).toHaveLength(2);
  });

  it('removes a rule when delete button is clicked', () => {
    const rules = [
      { column: 'revenue', operator: '>' as const, value: 10000, color: '#C8E6C9' },
      { column: 'count', operator: '<' as const, value: 5, color: '#FFCDD2' },
    ];
    render(<ConditionalFormattingSection {...defaultProps} rules={rules} />);
    fireEvent.click(screen.getByTestId('delete-rule-0'));
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      { column: 'count', operator: '<', value: 5, color: '#FFCDD2' },
    ]);
  });

  it('shows empty state when no columns available', () => {
    render(<ConditionalFormattingSection {...defaultProps} availableColumns={[]} />);
    expect(screen.getByText(/No columns available/)).toBeInTheDocument();
  });
});
