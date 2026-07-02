import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PivotTableChart from '../PivotTableChart';
import type { PivotTableResponse } from '@/types/pivot-table';

// One NGO with three status sub-rows. The ngo_name cell is merged across all three
// rows via rowSpan, so it renders once — search must count it once, not three times.
const data: PivotTableResponse = {
  column_keys: [],
  column_dimension_names: [],
  metric_headers: ['Total Count'],
  grand_total: null,
  rows: [
    {
      row_labels: ['Action Against Hunger', 'Completed'],
      is_subtotal: false,
      values: [],
      row_total: [18],
    },
    {
      row_labels: ['Action Against Hunger', 'In Progress'],
      is_subtotal: false,
      values: [],
      row_total: [7],
    },
    {
      row_labels: ['Action Against Hunger', 'Planned'],
      is_subtotal: false,
      values: [],
      row_total: [4],
    },
  ],
};

describe('PivotTableChart search count', () => {
  it('counts a rowSpan-merged row label once, not once per merged sub-row', async () => {
    const user = userEvent.setup();
    render(<PivotTableChart data={data} rowDimLabels={['ngo_name', 'status']} />);

    await user.type(screen.getByTestId('table-search-input'), 'Action Again');

    await waitFor(() =>
      expect(screen.getByTestId('table-search-count')).toHaveTextContent('1 match')
    );
  });
});
