import { redirect } from 'next/navigation';
import UserManagementPage from '../user-management/page';
import GroupsPage from '../groups/page';
import AccessManagementPage from '../access-management/page';

jest.mock('next/navigation', () => ({ redirect: jest.fn() }));

// The three pre-consolidation settings routes must land old links on the
// right tab of Settings → Access.
describe('legacy settings routes redirect to /settings/access', () => {
  beforeEach(() => jest.clearAllMocks());

  it('/settings/user-management → ?tab=people', () => {
    UserManagementPage();
    expect(redirect).toHaveBeenCalledWith('/settings/access?tab=people');
  });

  it('/settings/groups → ?tab=groups', () => {
    GroupsPage();
    expect(redirect).toHaveBeenCalledWith('/settings/access?tab=groups');
  });

  it('/settings/access-management → ?tab=roles', () => {
    AccessManagementPage();
    expect(redirect).toHaveBeenCalledWith('/settings/access?tab=roles');
  });
});
