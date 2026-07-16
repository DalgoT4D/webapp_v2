/**
 * ShareModal tests for the Phase C review fixes on the unified add-people
 * staging flow (share-modal-staging.tsx):
 *
 *  F1 — browse-without-typing: focusing the empty search opens a scrollable
 *       list of ALL groups first, then ALL org members (dup entries disabled).
 *  F2 — commit() guards against double submission (rapid double invoke
 *       sends exactly one batch).
 *  F3 — text typed but not staged is not silently dropped: SHARE flushes it
 *       through tokenize/validate first (invalid text blocks the commit),
 *       and blur stages valid residual email text.
 *
 * Extends share-modal-access / share-modal-groups / share-modal-email-invite
 * tests, which must keep passing unmodified.
 */
import React from 'react';
import { render, renderHook, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareModal } from '@/components/ui/share-modal';
import { useShareStaging, type StagedEntry } from '@/components/ui/share-modal-staging';
import {
  useResourceAccess,
  addGrant,
  type ResourceAccessOverview,
  type AccessGrant,
} from '@/hooks/api/useResourceAccess';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useUserGroups, type UserGroup } from '@/hooks/api/useUserGroups';
import { useRbac } from '@/lib/rbac';

jest.mock('@/hooks/api/useResourceAccess');
jest.mock('@/hooks/api/useUserManagement');
jest.mock('@/hooks/api/useUserGroups', () => ({
  ...jest.requireActual('@/hooks/api/useUserGroups'),
  useUserGroups: jest.fn(),
}));
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastError: { share: jest.fn(), load: jest.fn(), api: jest.fn() },
  toastInfo: { generic: jest.fn() },
}));
jest.mock('@/lib/clipboard', () => ({
  copyUrlToClipboard: jest.fn().mockResolvedValue(undefined),
}));

const mockUseResourceAccess = useResourceAccess as jest.Mock;
const mockUseUsers = useUsers as jest.Mock;
const mockUseUserGroups = useUserGroups as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;
const mockAddGrant = addGrant as jest.Mock;

const baseOverview: ResourceAccessOverview = {
  resource_type: 'dashboard',
  resource_id: '1',
  capabilities: { general: true, grants: true, public_link: true, requests: true },
  owner: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
  general_access: { audience: 'analysts_plus', level: 'view' },
  grants: [
    // Meera (user 9) and Funders (group 20) already have access — the
    // browse list must offer them disabled, not clickable.
    {
      id: 3,
      principal_type: 'user',
      principal_id: 9,
      email: 'meera@ngo.org',
      name: 'Meera Das',
      permission: 'view',
      status: 'active',
    },
    {
      id: 5,
      principal_type: 'group',
      principal_id: 20,
      email: null,
      name: 'Funders',
      permission: 'view',
      status: 'active',
      member_count: 4,
    },
  ],
  viewer: { effective_permission: 'edit', is_owner: false },
};

const mockGroups: UserGroup[] = [
  {
    id: 20,
    name: 'Funders',
    member_count: 4,
    shared_resource_count: 1,
    created_by: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
    created_at: '2026-01-01T00:00:00Z',
    member_preview: [],
  },
  {
    id: 21,
    name: 'Field staff',
    member_count: 8,
    shared_resource_count: 2,
    created_by: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
    created_at: '2026-01-01T00:00:00Z',
    member_preview: [],
  },
];

const mockOrgUsers = [
  { orguser_id: 42, email: 'new.person@ngo.org', new_role_slug: 'analyst' },
  { orguser_id: 9, email: 'meera@ngo.org', new_role_slug: 'member' },
];

const mockGetShareStatus = jest
  .fn()
  .mockResolvedValue({ is_public: false, public_access_count: 0 });
const mockUpdateSharing = jest.fn();

function renderModal(overrides: Partial<ResourceAccessOverview> = {}) {
  const mutate = jest.fn();
  const onClose = jest.fn();
  mockUseResourceAccess.mockReturnValue({
    data: { ...baseOverview, ...overrides },
    isLoading: false,
    isError: undefined,
    mutate,
  });
  mockUseUsers.mockReturnValue({ users: mockOrgUsers, isLoading: false });
  mockUseUserGroups.mockReturnValue({
    data: mockGroups,
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
  mockUseRbac.mockReturnValue({
    hasPermission: () => true,
    role: 'admin',
    isLoaded: true,
    hasRole: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });

  render(
    <ShareModal
      entityId={1}
      entityLabel="Dashboard"
      entityType="dashboard"
      isOpen
      onClose={onClose}
      getShareStatus={mockGetShareStatus}
      updateSharing={mockUpdateSharing}
    />
  );

  return { mutate, onClose };
}

function activeGrant(overrides: Partial<AccessGrant> = {}): AccessGrant {
  return {
    id: 100,
    principal_type: 'user',
    principal_id: 55,
    email: 'a@x.org',
    name: null,
    permission: 'view',
    status: 'active',
    ...overrides,
  };
}

function pasteIntoSearchInput(text: string) {
  const input = screen.getByTestId('share-search-input');
  fireEvent.paste(input, {
    clipboardData: { getData: () => text },
  });
}

describe('ShareModal — browse-without-typing (F1)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens a browse list of all groups first, then all org members, on focusing the empty input', async () => {
    const user = userEvent.setup();
    renderModal();

    // Nothing typed, nothing shown until the input is focused.
    expect(screen.queryByTestId('share-search-results')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('share-search-input'));

    const results = screen.getByTestId('share-search-results');
    expect(results).toBeInTheDocument();
    // Scrollable list — the Figma "scrollable list of users to share" pattern.
    expect(results.className).toMatch(/max-h-/);
    expect(results.className).toMatch(/overflow/);
    // OVERLAY contract (jsdom can't assert real layout, so pin the classes):
    // the dropdown must be absolutely positioned below the input, above the
    // modal content, with its own opaque surface — an in-flow list grows the
    // modal past small viewports and pushes the SHARE footer out of reach.
    expect(results.className).toMatch(/\babsolute\b/);
    expect(results.className).toMatch(/\btop-full\b/);
    expect(results.className).toMatch(/\bz-50\b/);
    expect(results.className).toMatch(/\bbg-popover\b/);
    // ...and its anchor wrapper must establish the positioning context.
    expect(results.parentElement?.className).toMatch(/\brelative\b/);

    // All groups first, then all org members.
    const items = screen.getAllByTestId(/^share-search-(group|user)-/);
    expect(items.map((el) => el.getAttribute('data-testid'))).toEqual([
      'share-search-group-20',
      'share-search-group-21',
      'share-search-user-42',
      'share-search-user-9',
    ]);
  });

  it('bounds the dialog to the viewport with internal scroll (CSS contract)', () => {
    renderModal();

    // Belt-and-braces against ANY section growth pushing the Close/SHARE
    // footer off small screens: the dialog itself is viewport-bounded and
    // scrolls internally (repo pattern — CreateOrgDialog, schema-change-form).
    const dialog = screen.getByTestId('share-modal');
    expect(dialog.className).toContain('max-h-[85vh]');
    expect(dialog.className).toContain('overflow-y-auto');
  });

  it('keeps the dup guard in the browse list: granted entries are disabled with "Already has access"', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('share-search-input'));

    const grantedGroup = screen.getByTestId('share-search-group-20');
    expect(grantedGroup).toBeDisabled();
    expect(grantedGroup).toHaveTextContent('Already has access');
    const grantedUser = screen.getByTestId('share-search-user-9');
    expect(grantedUser).toBeDisabled();
    expect(grantedUser).toHaveTextContent('Already has access');
    // Available entries stay clickable.
    expect(screen.getByTestId('share-search-group-21')).toBeEnabled();
    expect(screen.getByTestId('share-search-user-42')).toBeEnabled();
  });

  it('stages an entry picked from the browse list without typing', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('share-search-input'));
    await user.click(screen.getByTestId('share-search-user-42'));

    expect(screen.getByTestId('share-staged-row-user-42')).toHaveTextContent('new.person@ngo.org');
    expect(mockAddGrant).not.toHaveBeenCalled();
  });

  it('supports keyboard navigation: Tab into the browse list and Enter picks the entry', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('share-search-input'));
    // Group 20 is disabled (granted) so Tab lands on the first enabled item.
    await user.tab();
    expect(screen.getByTestId('share-search-group-21')).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('share-staged-row-group-21')).toHaveTextContent('Field staff');
  });

  it('closes the browse list when focus leaves the search area', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('share-search-input'));
    expect(screen.getByTestId('share-search-results')).toBeInTheDocument();

    await user.click(screen.getByTestId('share-close-btn'));

    expect(screen.queryByTestId('share-search-results')).not.toBeInTheDocument();
  });
});

describe('ShareModal — Escape layering (parity with GroupFormDialog)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('Escape closes only the dropdown first; a second Escape closes the dialog (no staged-work loss)', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByTestId('share-search-input'));
    expect(screen.getByTestId('share-search-results')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('share-search-results')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('staged rows survive the first Escape: typed-and-entered email chip stays after dropdown closes', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    const input = screen.getByTestId('share-search-input');
    await user.type(input, 'new.person@ngo.org{Enter}');
    expect(screen.getByTestId('share-staged-row-user-42')).toBeInTheDocument();

    // Refocus the input to reopen the dropdown, then press Escape once.
    await user.click(input);
    expect(screen.getByTestId('share-search-results')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('share-search-results')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    // The staged chip/row from before the Escape is untouched.
    expect(screen.getByTestId('share-staged-row-user-42')).toBeInTheDocument();
  });

  it('typing reopens a dropdown closed by Escape', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('share-search-input'));
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('share-search-results')).not.toBeInTheDocument();

    await user.type(screen.getByTestId('share-search-input'), 'new');
    expect(screen.getByTestId('share-search-results')).toBeInTheDocument();
  });

  it('outside-click dropdown dismissal keeps working (unaffected by the Escape handler)', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('share-search-input'));
    expect(screen.getByTestId('share-search-results')).toBeInTheDocument();

    await user.click(screen.getByTestId('share-close-btn'));
    expect(screen.queryByTestId('share-search-results')).not.toBeInTheDocument();
  });
});

describe('useShareStaging — double-submit guard (F2)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('a rapid double commit() sends exactly one batch', async () => {
    const entry: StagedEntry = {
      key: 'email-solo@x.org',
      kind: 'email',
      label: 'solo@x.org',
      tag: 'New',
      email: 'solo@x.org',
      permission: 'view',
      status: 'staged',
    };
    mockAddGrant.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(activeGrant({ id: 500, email: 'solo@x.org' })), 20)
        )
    );

    const { result } = renderHook(() =>
      useShareStaging({
        entityType: 'dashboard',
        entityId: 1,
        isOpen: true,
        onCommitted: jest.fn(),
      })
    );

    act(() => result.current.stage([entry]));

    await act(async () => {
      // Two invokes before any re-render can disable the button.
      const first = result.current.commit();
      const second = result.current.commit();
      await Promise.all([first, second]);
    });

    expect(mockAddGrant).toHaveBeenCalledTimes(1);
  });
});

describe('ShareModal — residual typed text (F3)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('SHARE with an email typed but not entered stages and commits it', async () => {
    const user = userEvent.setup();
    mockAddGrant.mockResolvedValue(
      activeGrant({ id: 300, email: 'typed@x.org', principal_id: null, status: 'pending' })
    );
    renderModal();

    await user.type(screen.getByTestId('share-search-input'), 'typed@x.org');

    // Residual text alone must enable SHARE, or the click could never flush it.
    const commitBtn = screen.getByTestId('share-commit-btn');
    expect(commitBtn).toBeEnabled();
    await user.click(commitBtn);

    await waitFor(() => {
      expect(mockAddGrant).toHaveBeenCalledWith('dashboard', 1, {
        principal_type: 'user',
        email: 'typed@x.org',
        permission: 'view',
        invite_role: 'member',
      });
    });
    expect(mockAddGrant).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByTestId('share-staged-row-email-typed@x.org')).not.toBeInTheDocument();
    });
  });

  it('invalid residual text blocks the commit with the inline error, sending nothing', async () => {
    const user = userEvent.setup();
    renderModal();

    // A valid staged row plus invalid residual text: the whole commit aborts.
    pasteIntoSearchInput('ok@x.org');
    await user.type(screen.getByTestId('share-search-input'), 'not-an-email');
    await user.click(screen.getByTestId('share-commit-btn'));

    const invalidRow = await screen.findByTestId('share-staged-row-email-not-an-email');
    expect(invalidRow).toHaveAttribute('data-status', 'invalid');
    expect(invalidRow).toHaveTextContent('Not a valid email address');
    expect(mockAddGrant).not.toHaveBeenCalled();
    // The valid row stays staged for the next attempt.
    expect(screen.getByTestId('share-staged-row-email-ok@x.org')).toHaveAttribute(
      'data-status',
      'staged'
    );
  });

  it('stages valid residual email text when the input loses focus', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId('share-search-input'), 'blurred@x.org');
    // Click something outside the search area (not SHARE) to blur.
    await user.click(screen.getByTestId('share-close-btn'));

    expect(screen.getByTestId('share-staged-row-email-blurred@x.org')).toHaveAttribute(
      'data-status',
      'staged'
    );
    expect(screen.getByTestId('share-search-input')).toHaveValue('');
    expect(mockAddGrant).not.toHaveBeenCalled();
  });

  it('does not blur-stage partial search text when picking a dropdown entry', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId('share-search-input'), 'new.person');
    await user.click(screen.getByTestId('share-search-user-42'));

    // Only the picked member is staged — no junk row from the partial text.
    expect(screen.getByTestId('share-staged-row-user-42')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^share-staged-row-/)).toHaveLength(1);
  });
});
