import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyWarehouseCard } from '../empty-warehouse-card';
import * as rbac from '@/lib/rbac';

jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));

const mockRbac = rbac.useRbac as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockRbac.mockReturnValue({ hasPermission: () => true });
});

it('re-opens the warehouse wizard when the setup button is clicked', async () => {
  const user = userEvent.setup();
  const onSetUp = jest.fn();
  render(<EmptyWarehouseCard onSetUp={onSetUp} />);

  await user.click(screen.getByTestId('setup-warehouse-btn'));
  expect(onSetUp).toHaveBeenCalledTimes(1);
});

it('disables setup and shows a hint when the user cannot create a warehouse', () => {
  mockRbac.mockReturnValue({ hasPermission: () => false });
  render(<EmptyWarehouseCard onSetUp={jest.fn()} />);

  expect(screen.getByTestId('setup-warehouse-btn')).toBeDisabled();
  expect(screen.getByText(/don't have permission/i)).toBeInTheDocument();
});
