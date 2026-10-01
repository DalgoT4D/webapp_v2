import { render, screen } from '@testing-library/react';
import { ResultTable } from '../ResultTable';

describe('ResultTable', () => {
  it('renders columns, rows, and the row count', () => {
    render(
      <ResultTable
        table={{
          columns: ['district', 'count'],
          rows: [
            ['Pune', '812'],
            ['Nashik', '472'],
          ],
          row_count: 2,
        }}
      />
    );

    expect(screen.getByText('district')).toBeInTheDocument();
    expect(screen.getByText('count')).toBeInTheDocument();
    expect(screen.getByText('Pune')).toBeInTheDocument();
    expect(screen.getByText('472')).toBeInTheDocument();
    expect(screen.getByText(/2 rows/)).toBeInTheDocument();
  });

  it('renders nothing for an empty result', () => {
    const { container } = render(<ResultTable table={{ columns: [], rows: [], row_count: 0 }} />);
    expect(container.firstChild).toBeNull();
  });
});
