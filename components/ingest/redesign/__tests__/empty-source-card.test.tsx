import { render, screen, fireEvent } from '@testing-library/react';
import { EmptySourceCard } from '../empty-source-card';

jest.mock('@/lib/rbac', () => ({
  useRbac: () => ({ hasPermission: () => true }),
  PERMISSIONS: { CAN_CREATE_SOURCE: 'can_create_source' },
}));

it('calls onAddSource when the primary button is clicked', () => {
  const onAddSource = jest.fn();
  render(<EmptySourceCard onAddSource={onAddSource} />);
  fireEvent.click(screen.getByRole('button', { name: /add.*source/i }));
  expect(onAddSource).toHaveBeenCalledTimes(1);
});
