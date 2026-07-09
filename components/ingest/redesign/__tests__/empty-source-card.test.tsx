import { render, screen, fireEvent } from '@testing-library/react';
import { EmptySourceCard } from '../empty-source-card';

jest.mock('@/lib/rbac', () => ({
  useRbac: () => ({ hasPermission: () => true }),
  PERMISSIONS: { CAN_CREATE_SOURCE: 'can_create_source' },
}));

jest.mock('@/components/ingest/sources/wizard/AddSourceWizard', () => ({
  AddSourceWizard: ({ open }: any) => (open ? <div data-testid="wizard-open" /> : null),
}));

it('opens the AddSourceWizard when the primary button is clicked', () => {
  render(<EmptySourceCard onCreated={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /add.*source/i }));
  expect(screen.getByTestId('wizard-open')).toBeInTheDocument();
});
