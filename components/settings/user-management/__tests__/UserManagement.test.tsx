import { render, screen } from '@testing-library/react';
import UserManagement from '../UserManagement';

jest.mock('@/lib/analytics', () => ({ trackFeatureView: jest.fn(), trackEvent: jest.fn() }));

jest.mock('../PeopleTable', () => ({
  PeopleTable: ({ onInviteClick }: { onInviteClick?: () => void }) => (
    <div data-testid="people-table" onClick={onInviteClick}>
      people-table
    </div>
  ),
}));

jest.mock('../InviteUserDialog', () => ({
  InviteUserDialog: ({ open }: { open: boolean }) => (
    <div data-testid="invite-dialog">{open ? 'open' : 'closed'}</div>
  ),
}));

describe('UserManagement — merged People panel', () => {
  it('renders the merged PeopleTable with no secondary Users/Pending tabs or role-info tooltip', () => {
    render(<UserManagement showInviteDialog={false} onShowInviteDialogChange={jest.fn()} />);

    expect(screen.getByTestId('people-table')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-users')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-pending')).not.toBeInTheDocument();
    expect(screen.queryByTestId('role-info-tooltip-trigger')).not.toBeInTheDocument();
  });

  it('passes the invite dialog open state through to InviteUserDialog', () => {
    render(<UserManagement showInviteDialog={true} onShowInviteDialogChange={jest.fn()} />);

    expect(screen.getByTestId('invite-dialog')).toHaveTextContent('open');
  });
});
