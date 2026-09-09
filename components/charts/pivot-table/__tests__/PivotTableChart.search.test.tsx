import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PivotTableChart from '../PivotTableChart';
import type { PivotTableResponse } from '@/types/pivot-table';

// One NGO with three status sub-rows. The ngo_name cell is merged across all three
// rows via rowSpan, so it renders once — search must count it once, not three times.
const data: PivotTableResponse = {
  row_dimension_names: ['ngo_name', 'status'],
  column_dimension_names: [],
  metric_headers: ['Total Count'],
  column_keys: [],
  column_subtotal_keys: [],
  cells: [
    {
      row_key: ['Action Against Hunger', 'Completed'],
      col_key: [],
      row_kind: 'data',
      col_kind: 'row_total',
      values: [18],
    },
    {
      row_key: ['Action Against Hunger', 'In Progress'],
      col_key: [],
      row_kind: 'data',
      col_kind: 'row_total',
      values: [7],
    },
    {
      row_key: ['Action Against Hunger', 'Planned'],
      col_key: [],
      row_kind: 'data',
      col_kind: 'row_total',
      values: [4],
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
