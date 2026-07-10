import { render, screen } from '@testing-library/react';
import { WarehouseChip } from '../warehouse-chip';
import type { Warehouse } from '@/types/warehouse';

const warehouse = { name: 'hobbit_pantry_1', wtype: 'postgres' } as Warehouse;

it('renders a link to Settings → Warehouse with the name and type', () => {
  render(<WarehouseChip warehouse={warehouse} />);

  const chip = screen.getByTestId('warehouse-chip');
  // It navigates (anchor), not a dialog trigger.
  expect(chip.tagName).toBe('A');
  expect(chip).toHaveAttribute('href', '/settings/warehouse');

  expect(screen.getByText('Warehouse:')).toBeInTheDocument();
  expect(screen.getByText('hobbit_pantry_1')).toBeInTheDocument();
  expect(screen.getByText('(postgres)')).toBeInTheDocument(); // uppercased via CSS
});

it('does not open a warehouse dialog anymore', () => {
  render(<WarehouseChip warehouse={warehouse} />);
  expect(screen.queryByTestId('warehouse-panel-dialog')).not.toBeInTheDocument();
});
