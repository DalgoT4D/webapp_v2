import { render, screen } from '@testing-library/react';
import { ColumnAlignmentSection } from '../ColumnAlignmentSection';

describe('ColumnAlignmentSection', () => {
  const defaultProps = {
    columns: ['name', 'revenue', 'count'],
    alignment: {} as Record<string, string>,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    defaultProps.onChange.mockClear();
  });

  it('renders section heading', () => {
    render(<ColumnAlignmentSection {...defaultProps} />);
    expect(screen.getByText('Column Alignment')).toBeInTheDocument();
  });

  it('renders a row for each column', () => {
    render(<ColumnAlignmentSection {...defaultProps} />);
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('revenue')).toBeInTheDocument();
    expect(screen.getByText('count')).toBeInTheDocument();
  });

  it('shows empty state when no columns', () => {
    render(<ColumnAlignmentSection {...defaultProps} columns={[]} />);
    expect(screen.getByText(/No columns/)).toBeInTheDocument();
  });
});
