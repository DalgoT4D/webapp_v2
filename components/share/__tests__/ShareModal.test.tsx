import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareModal } from '@/components/ui/share-modal';
import * as access from '@/hooks/api/useAccess';
import { copyUrlToClipboard } from '@/lib/clipboard';
import type { ShareRow } from '@/types/access';
import type { PersonRow } from '@/types/user-management';
import type { GroupListRow } from '@/types/user-groups';

jest.mock('@/hooks/api/useAccess');
jest.mock('@/hooks/api/useUserManagement', () => ({
  useRoles: () => ({
    roles: [
      { uuid: 'role-admin', slug: 'admin', name: 'Admin' },
      { uuid: 'role-member', slug: 'member', name: 'Member' },
    ],
  }),
}));
let mockRoleSlug = 'member';
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: object) => unknown) =>
    selector({
      getCurrentOrgUser: () => ({ email: 'me@ngo.org', new_role_slug: mockRoleSlug }),
    }),
}));
jest.mock('@/lib/clipboard', () => ({ copyUrlToClipboard: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastError: { api: jest.fn() },
}));

const mockedAccess = access as jest.Mocked<typeof access>;
const addGrants = jest.fn();

const makeGeneralAccess = (
  overrides: Partial<access.GeneralAccessState> = {}
): access.GeneralAccessState => ({
  mode: 'internal' as const,
  supports_public: true,
  allow_public_sharing: true,
  public_url: null,
  public_access_count: 0,
  last_public_accessed: null,
  caller_access_via_floor: false,
  parent_blocks: [],
  ...overrides,
});

const makeShare = (overrides: Partial<ShareRow> = {}): ShareRow => ({
  share_id: 3,
  principal_type: 'user',
  principal_id: 11,
  email: 'ana@ngo.org',
  label: 'ana@ngo.org',
  role_or_group: 'Member',
  access_level: 'view',
  status: 'active',
  cascade_sources: [],
  ...overrides,
});

function setup({
  generalAccess = makeGeneralAccess(),
  shares = [] as ShareRow[],
  requests = [] as access.AccessRequestRow[],
} = {}) {
  mockedAccess.useActiveMembers.mockReturnValue({ people: [] } as never);
  mockedAccess.useUserGroups.mockReturnValue({ groups: [] } as never);
  mockedAccess.useResourceGrants.mockReturnValue({
    shares,
    callerIsOwner: true,
    generalAccess,
    owner: { orguser_id: 1, email: 'owner@ngo.org', role_name: 'Admin' },
    mutate: jest.fn(),
  } as never);
  mockedAccess.useAccessRequests.mockReturnValue({ requests, mutate: jest.fn() } as never);
  mockedAccess.useResourceGrantActions.mockReturnValue({
    addGrants,
    updateGrant: jest.fn(),
    removeGrant: jest.fn(),
  } as never);
}

function renderModal(props: Partial<React.ComponentProps<typeof ShareModal>> = {}) {
  const onClose = jest.fn();
  render(
    <ShareModal
      rtype="report"
      entityId={9}
      entityLabel="Q3 Report"
      isOpen={true}
      onClose={onClose}
      {...props}
    />
  );
  return { onClose };
}

describe('ShareModal (characterization)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoleSlug = 'member';
    addGrants.mockResolvedValue({ shares: [], warnings: [] });
    setup();
  });

  it('title, owner row, disabled SHARE, Default description; no dashboard hint, no legacy email section', () => {
    renderModal();
    expect(screen.getByText('Share "Q3 Report"')).toBeInTheDocument();
    expect(screen.getByTestId('share-owner-row')).toHaveTextContent('owner@ngo.org');
    expect(screen.getByTestId('share-submit-btn')).toBeDisabled();
    expect(screen.getByTestId('general-access-description')).toHaveTextContent(
      'Users can access this resource based on their role permissions'
    );
    expect(
      screen.queryByText('All inner charts and KPIs will inherit this permission.')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('share-modal-email-input')).not.toBeInTheDocument();
  });

  it('dashboards show the inherit hint', () => {
    renderModal({ rtype: 'dashboard' });
    expect(
      screen.getByText('All inner charts and KPIs will inherit this permission.')
    ).toBeInTheDocument();
  });

  it('public: notice uses the lower-cased title (pinned R-S1), copy link, access stats', async () => {
    setup({
      generalAccess: makeGeneralAccess({
        mode: 'public',
        public_url: 'https://app.example/share/report/tok',
        public_access_count: 2,
      }),
    });
    (copyUrlToClipboard as jest.Mock).mockResolvedValue(true);
    const onCopyLink = jest.fn();
    renderModal({ onCopyLink });

    expect(screen.getByTestId('public-security-notice')).toHaveTextContent(
      'Anyone with this link can access your q3 report data without authentication.'
    );
    expect(screen.getByTestId('public-access-count')).toHaveTextContent('Public access count: 2');
    await userEvent.setup().click(screen.getByTestId('copy-link-btn'));
    expect(copyUrlToClipboard).toHaveBeenCalledWith('https://app.example/share/report/tok');
    await waitFor(() => expect(onCopyLink).toHaveBeenCalled());
  });

  it('public with public sharing turned off: admin message, no notice', () => {
    setup({ generalAccess: makeGeneralAccess({ mode: 'public', allow_public_sharing: false }) });
    renderModal();
    expect(screen.getByTestId('general-access-description')).toHaveTextContent(
      'Public sharing is turned off by your admin'
    );
    expect(screen.queryByTestId('public-security-notice')).not.toBeInTheDocument();
  });

  it('options restricted by shared parent dashboards are explained', () => {
    setup({
      generalAccess: makeGeneralAccess({
        parent_blocks: [{ dashboard_id: 1, dashboard_title: 'Board', mode: 'internal' }],
      }),
    });
    renderModal();
    expect(screen.getByTestId('general-access-restricted-text')).toHaveTextContent('Board');
  });

  it('legacy email section renders only when onShareViaEmail is passed', () => {
    renderModal({ onShareViaEmail: jest.fn() });
    expect(screen.getByTestId('share-modal-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('share-modal-email-send-btn')).toHaveTextContent(
      'Send to 0 recipients'
    );
  });

  it('approving an access request grants the requested level', async () => {
    setup({
      requests: [
        {
          id: 5,
          requester_id: 2,
          requester_email: 'm@ngo.org',
          requested_level: 'edit',
          note: null,
          status: 'pending',
          created_at: '2026-08-01T00:00:00Z',
        },
      ],
    });
    mockedAccess.respondToAccessRequest.mockResolvedValue(undefined);
    renderModal();
    expect(screen.getByTestId('access-request-row-5')).toHaveTextContent('m@ngo.org wants to edit');
    await userEvent.setup().click(screen.getByTestId('access-request-approve-5'));
    expect(mockedAccess.respondToAccessRequest).toHaveBeenCalledWith(
      'report',
      9,
      5,
      'approved',
      'edit'
    );
  });

  it('rows: "You" pill on your own share; cascade-only rows use the inherited testid and cannot be removed', () => {
    setup({
      shares: [
        makeShare({ share_id: 3, email: 'ME@ngo.org', label: 'ME@ngo.org' }),
        makeShare({
          share_id: null,
          principal_id: 12,
          email: 'ravi@ngo.org',
          label: 'ravi@ngo.org',
          cascade_sources: [{ dashboard_id: 1, dashboard_title: 'Board' }],
        }),
      ],
    });
    renderModal();
    expect(within(screen.getByTestId('share-grant-row-3')).getByText('You')).toBeInTheDocument();
    expect(screen.getByTestId('share-grant-row-inherited-user-12')).toBeInTheDocument();
    expect(screen.getByTestId('share-grant-remove-inherited-user-12')).toBeDisabled();
  });

  it('staging a new email (non-admin): warning, Member invite, grant payload, closes', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.type(screen.getByTestId('share-chip-input'), 'new@ngo.org{Enter}');

    expect(screen.getByText("new@ngo.org isn't on Dalgo yet.")).toBeInTheDocument();
    expect(screen.getByText('They will be invited as', { exact: false })).toBeInTheDocument();
    expect(screen.queryByTestId('share-invite-role')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('share-submit-btn'));
    expect(addGrants).toHaveBeenCalledWith({
      principals: [],
      pending_grants: [{ email: 'new@ngo.org', access_level: 'view' }],
      invite_role_uuid: 'role-member',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('stages several emails at once (plural warning); admins pick the invite role', async () => {
    mockRoleSlug = 'admin';
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByTestId('share-chip-input'), 'a@x.org b@x.org{Enter}');

    expect(screen.getByText("2 emails aren't on Dalgo yet.")).toBeInTheDocument();
    expect(screen.getByText('Choose a role for new invites before sharing.')).toBeInTheDocument();
    expect(screen.getByTestId('share-invite-role')).toBeInTheDocument();
  });

  describe('wiring through the component', () => {
    const person = (email: string, orguserId: number, roleName = 'Member'): PersonRow => ({
      email,
      role_slug: 'member',
      role_name: roleName,
      status: 'active',
      created_by_email: null,
      orguser_id: orguserId,
      invitation_id: null,
      created_at: null,
    });
    const group = (id: number, name: string): GroupListRow => ({
      id,
      name,
      member_count: 1,
      created_by_email: null,
      created_at: '2026-01-01',
    });

    function seedPeopleAndGroups() {
      mockedAccess.useActiveMembers.mockReturnValue({
        people: [
          person('owner@ngo.org', 1, 'Admin'),
          person('shared@ngo.org', 2),
          person('free@ngo.org', 4),
        ],
      } as never);
      mockedAccess.useUserGroups.mockReturnValue({
        groups: [group(9, 'NGO staff'), group(8, 'NGO donors')],
      } as never);
    }

    function stubGrantActions() {
      const actions = { addGrants, updateGrant: jest.fn(), removeGrant: jest.fn() };
      mockedAccess.useResourceGrantActions.mockReturnValue(actions as never);
      return actions;
    }

    // Suggestion buttons are named "<label><badge>"; anchoring on the label avoids the
    // "Remove …" / "Take ownership from …" buttons that also mention the email.
    const suggestion = (label: string) =>
      screen.getByRole('button', { name: new RegExp(`^${label.replace(/[.]/g, '\\.')}`) });

    it('typeahead: users before groups; owner and already-shared principals disabled with reasons', async () => {
      setup({
        shares: [
          makeShare({
            share_id: 3,
            principal_id: 2,
            email: 'shared@ngo.org',
            label: 'shared@ngo.org',
          }),
          makeShare({
            share_id: 4,
            principal_type: 'group',
            principal_id: 8,
            email: null,
            label: 'NGO donors',
            role_or_group: 'Group',
          }),
        ],
      });
      seedPeopleAndGroups();
      renderModal();
      await userEvent.setup().type(screen.getByTestId('share-chip-input'), 'ngo');

      const owner = suggestion('owner@ngo.org');
      const shared = suggestion('shared@ngo.org');
      const free = suggestion('free@ngo.org');
      const staff = suggestion('NGO staff');
      const donors = suggestion('NGO donors');

      expect(owner).toHaveTextContent('Owner');
      expect(owner).toBeDisabled();
      expect(owner).toHaveAttribute('title', 'Already the owner — has full access');
      expect(shared).toBeDisabled();
      expect(shared).toHaveAttribute('title', 'Already has access');
      expect(donors).toBeDisabled();
      expect(donors).toHaveAttribute('title', 'Already has access');
      expect(free).toBeEnabled();
      expect(free).not.toHaveAttribute('title');
      expect(free).toHaveTextContent('Member');
      expect(staff).toBeEnabled();
      expect(staff).toHaveTextContent('Group');

      const order = [owner, shared, free, staff, donors];
      order.slice(1).forEach((el, i) => {
        expect(
          order[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
      });
    });

    it('selecting a user and a group stages chips and SHARE sends them as principals', async () => {
      seedPeopleAndGroups();
      const user = userEvent.setup();
      const { onClose } = renderModal();

      await user.type(screen.getByTestId('share-chip-input'), 'free');
      await user.click(suggestion('free@ngo.org'));
      expect(screen.getByTestId('share-chip-input')).toHaveValue('');
      expect(screen.getByTestId('share-chip-remove-user:4')).toBeInTheDocument();

      await user.type(screen.getByTestId('share-chip-input'), 'staff');
      await user.click(suggestion('NGO staff'));
      expect(screen.getByTestId('share-chip-remove-group:9')).toBeInTheDocument();

      expect(screen.getByTestId('share-submit-btn')).toBeEnabled();
      await user.click(screen.getByTestId('share-submit-btn'));
      expect(addGrants).toHaveBeenCalledWith({
        principals: [
          { principal_type: 'user', principal_id: 4, access_level: 'view' },
          { principal_type: 'group', principal_id: 9, access_level: 'view' },
        ],
        pending_grants: [],
        invite_role_uuid: null,
      });
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('cascade-only View row: View option disabled; picking Edit adds a direct Edit grant', async () => {
      setup({
        shares: [
          makeShare({
            share_id: null,
            principal_id: 12,
            email: 'ravi@ngo.org',
            label: 'ravi@ngo.org',
            access_level: 'view',
            cascade_sources: [{ dashboard_id: 1, dashboard_title: 'Board' }],
          }),
        ],
      });
      const actions = stubGrantActions();
      const user = userEvent.setup();
      renderModal();

      await user.click(screen.getByTestId('share-grant-level-inherited-user-12'));
      expect(screen.getByTestId('share-grant-level-inherited-user-12-option-view')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(
        screen.getByTestId('share-grant-level-inherited-user-12-option-edit')
      ).not.toHaveAttribute('aria-disabled');

      await user.click(screen.getByTestId('share-grant-level-inherited-user-12-option-edit'));
      await waitFor(() =>
        expect(addGrants).toHaveBeenCalledWith({
          principals: [{ principal_type: 'user', principal_id: 12, access_level: 'edit' }],
        })
      );
      expect(actions.updateGrant).not.toHaveBeenCalled();
    });

    it('dashboards confirm a row level change before updating it', async () => {
      setup({ shares: [makeShare({ share_id: 3, access_level: 'view' })] });
      const actions = stubGrantActions();
      actions.updateGrant.mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderModal({ rtype: 'dashboard' });

      await user.click(screen.getByTestId('share-grant-level-3'));
      await user.click(screen.getByTestId('share-grant-level-3-option-edit'));
      expect(screen.getByTestId('share-cascade-dialog')).toHaveTextContent(
        'Update dashboard permissions?'
      );
      expect(actions.updateGrant).not.toHaveBeenCalled();

      await user.click(screen.getByTestId('share-cascade-continue-btn'));
      await waitFor(() => expect(actions.updateGrant).toHaveBeenCalledWith(3, 'edit'));
    });

    it('direct rows can be removed; Transfer ownership is offered only on an Edit user row', async () => {
      setup({
        shares: [
          makeShare({ share_id: 3, access_level: 'view' }),
          makeShare({
            share_id: 5,
            principal_id: 15,
            email: 'ed@ngo.org',
            label: 'ed@ngo.org',
            access_level: 'edit',
          }),
        ],
      });
      const user = userEvent.setup();
      renderModal();

      expect(screen.getByTestId('share-grant-remove-3')).toBeEnabled();
      expect(screen.getByTestId('share-grant-remove-5')).toBeEnabled();

      await user.click(screen.getByTestId('share-grant-level-5'));
      expect(screen.getByTestId('share-grant-level-5-option-transfer')).toHaveTextContent(
        'Transfer ownership'
      );
      await user.keyboard('{Escape}');

      await user.click(screen.getByTestId('share-grant-level-3'));
      expect(screen.queryByTestId('share-grant-level-3-option-transfer')).not.toBeInTheDocument();
    });
  });
});
