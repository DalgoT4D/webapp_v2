import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyWarehouseCard } from '../empty-warehouse-card';
import * as rbac from '@/lib/rbac';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));

const mockRbac = rbac.useRbac as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockRbac.mockReturnValue({ hasPermission: () => true });
});

it('routes to Settings → Warehouse when the setup button is clicked', async () => {
  const user = userEvent.setup();
  render(<EmptyWarehouseCard />);

  await user.click(screen.getByTestId('setup-warehouse-btn'));
  expect(mockPush).toHaveBeenCalledWith('/settings/warehouse');
});

it('disables setup and shows a hint when the user cannot create a warehouse', () => {
  mockRbac.mockReturnValue({ hasPermission: () => false });
  render(<EmptyWarehouseCard />);

  expect(screen.getByTestId('setup-warehouse-btn')).toBeDisabled();
  expect(screen.getByText(/don't have permission/i)).toBeInTheDocument();
});
