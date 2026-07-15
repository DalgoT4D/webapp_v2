/**
 * ShareModal tests for free-typed / pasted emails in the unified add-people
 * search (Phase C rework of the Milestone 4 invite panel). Backend contract
 * (task-09 + Phase C3): POST .../grants/ with {principal_type:'user', email,
 * permission, invite_role} resolves to an instant active grant for a known
 * org email, or an invitation (at invite_role, Member by default) + pending
 * grant for an unknown one — the response `status` tells us which.
 * Extends share-modal-access.test.tsx / share-modal-groups.test.tsx, which
 * must keep passing unmodified.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareModal } from '@/components/ui/share-modal';
import {
  useResourceAccess,
  addGrant,
  removeGrant,
  type ResourceAccessOverview,
  type AccessGrant,
} from '@/hooks/api/useResourceAccess';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useUserGroups } from '@/hooks/api/useUserGroups';
import { useRbac } from '@/lib/rbac';
import { trackEvent } from '@/lib/analytics';

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
const mockRemoveGrant = removeGrant as jest.Mock;

// Re-import the mocked toast module so assertions can reach the jest.fn()s.
import { toastSuccess, toastInfo } from '@/lib/toast';
const mockToastSuccess = toastSuccess.generic as jest.Mock;
const mockToastInfo = toastInfo.generic as jest.Mock;

const baseOverview: ResourceAccessOverview = {
  resource_type: 'dashboard',
  resource_id: '1',
  capabilities: { general: true, grants: true, public_link: true, requests: true },
  owner: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
  general_access: { audience: 'analysts_plus', level: 'view' },
  grants: [],
  viewer: { effective_permission: 'edit', is_owner: false },
};

const mockGetShareStatus = jest
  .fn()
  .mockResolvedValue({ is_public: false, public_access_count: 0 });
const mockUpdateSharing = jest.fn();

interface RenderOptions {
  isAdmin?: boolean;
  orgUsers?: { orguser_id: number; email: string; new_role_slug: string }[];
}

function renderModal(
  overrides: Partial<ResourceAccessOverview> = {},
  { isAdmin = true, orgUsers = [] }: RenderOptions = {}
) {
  const mutate = jest.fn();
  mockUseResourceAccess.mockReturnValue({
    data: { ...baseOverview, ...overrides },
    isLoading: false,
    isError: undefined,
    mutate,
  });
  mockUseUsers.mockReturnValue({ users: orgUsers, isLoading: false });
  mockUseUserGroups.mockReturnValue({
    data: [],
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
  mockUseRbac.mockReturnValue({
    hasPermission: () => true,
    role: isAdmin ? 'admin' : 'analyst',
    isLoaded: true,
    hasRole: () => isAdmin,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });

  render(
    <ShareModal
      entityId={1}
      entityLabel="Dashboard"
      entityType="dashboard"
      isOpen
      onClose={jest.fn()}
      getShareStatus={mockGetShareStatus}
      updateSharing={mockUpdateSharing}
    />
  );

  return { mutate };
}

function pasteIntoSearchInput(text: string) {
  const input = screen.getByTestId('share-search-input');
  fireEvent.paste(input, {
    clipboardData: { getData: () => text },
  });
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

describe('ShareModal — email parsing into staged rows', () => {
  beforeEach(() => jest.clearAllMocks());

  it('parses a paste of comma/newline-separated emails into staged + invalid rows', () => {
    renderModal();

    pasteIntoSearchInput('a@x.org, b@x.org\nbad-email');

    expect(screen.getByTestId('share-staged-row-email-a@x.org')).toHaveAttribute(
      'data-status',
      'staged'
    );
    expect(screen.getByTestId('share-staged-row-email-b@x.org')).toHaveAttribute(
      'data-status',
      'staged'
    );
    // Invalid tokens are rejected inline: kept visible, never sent.
    const badRow = screen.getByTestId('share-staged-row-email-bad-email');
    expect(badRow).toHaveAttribute('data-status', 'invalid');
    expect(badRow).toHaveTextContent('Not a valid email address');
  });

  it('dedups the same email pasted twice, case-insensitively', () => {
    renderModal();

    pasteIntoSearchInput('a@x.org, A@X.ORG');

    expect(screen.getAllByTestId('share-staged-row-email-a@x.org')).toHaveLength(1);
  });

  it('strips the mail-client "Name <email>" wrapper into a single staged row', () => {
    renderModal();

    pasteIntoSearchInput('Asha Kumar <a@x.org>');

    expect(screen.getByTestId('share-staged-row-email-a@x.org')).toHaveAttribute(
      'data-status',
      'staged'
    );
    // The display-name part must not become a row of its own.
    expect(screen.getAllByTestId(/^share-staged-row-/)).toHaveLength(1);
  });

  it('parses a bare angle-bracketed token to the inner email', () => {
    renderModal();

    pasteIntoSearchInput('<a@x.org>');

    expect(screen.getByTestId('share-staged-row-email-a@x.org')).toHaveAttribute(
      'data-status',
      'staged'
    );
    expect(screen.getAllByTestId(/^share-staged-row-/)).toHaveLength(1);
  });

  it('marks a token with an unmatched angle bracket as invalid and keeps SHARE disabled', () => {
    renderModal();

    pasteIntoSearchInput('<a@x.org');

    expect(screen.getByTestId('share-staged-row-email-<a@x.org')).toHaveAttribute(
      'data-status',
      'invalid'
    );
    expect(screen.getByTestId('share-commit-btn')).toBeDisabled();
  });

  it('stages a typed email via Enter', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByTestId('share-search-input'), 'typed@x.org{Enter}');

    expect(screen.getByTestId('share-staged-row-email-typed@x.org')).toHaveAttribute(
      'data-status',
      'staged'
    );
    expect(screen.getByTestId('share-search-input')).toHaveValue('');
  });

  it('stages an email matching an org member as that member (role tag, principal_id commit)', async () => {
    const user = userEvent.setup();
    mockAddGrant.mockResolvedValue(activeGrant({ id: 300, principal_id: 42 }));
    renderModal(
      {},
      { orgUsers: [{ orguser_id: 42, email: 'member@ngo.org', new_role_slug: 'analyst' }] }
    );

    pasteIntoSearchInput('member@ngo.org');

    const row = screen.getByTestId('share-staged-row-user-42');
    expect(row).toHaveTextContent('Analyst');
    // Known members never trigger the invite-role block.
    expect(screen.queryByTestId('share-invite-role-block')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('share-commit-btn'));

    await waitFor(() => {
      expect(mockAddGrant).toHaveBeenCalledWith('dashboard', 1, {
        principal_type: 'user',
        principal_id: 42,
        permission: 'view',
      });
    });
  });

  it('marks an email that already has access instead of staging it as sendable', () => {
    renderModal({
      grants: [activeGrant({ id: 44, email: 'granted@x.org', principal_id: 66 })],
    });

    pasteIntoSearchInput('granted@x.org');

    const row = screen.getByTestId('share-staged-row-email-granted@x.org');
    expect(row).toHaveAttribute('data-status', 'already');
    expect(row).toHaveTextContent('Already has access');
    expect(screen.getByTestId('share-commit-btn')).toBeDisabled();
  });
});

describe('ShareModal — invite-role picker (Phase C3)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('appears once an unknown email is staged, with the single-email copy', () => {
    renderModal();

    expect(screen.queryByTestId('share-invite-role-block')).not.toBeInTheDocument();

    pasteIntoSearchInput('new@x.org');

    expect(screen.getByTestId('share-invite-role-block')).toBeInTheDocument();
    expect(screen.getByTestId('share-invite-role-copy')).toHaveTextContent(
      "new@x.org isn't on Dalgo yet."
    );
    expect(screen.getByTestId('share-invite-role-block')).toHaveTextContent(
      'Assign new invites role before sharing the resource.'
    );
  });

  it('offers Member/Analyst/Admin to admins', async () => {
    const user = userEvent.setup();
    renderModal({}, { isAdmin: true });

    pasteIntoSearchInput('new@x.org');
    await user.click(screen.getByTestId('share-invite-role'));

    expect(screen.getByRole('option', { name: 'Member' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Analyst' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Admin' })).toBeInTheDocument();
  });

  it('locks non-admins to a plain "invited as member" sentence, with no role dropdown at all', () => {
    renderModal({}, { isAdmin: false });

    pasteIntoSearchInput('new@x.org');

    expect(screen.getByTestId('share-invite-role-block')).toHaveTextContent(
      'New member will be invited as member.'
    );
    // Non-admins can't pick a role — the backend 403s any non-Member
    // invite_role from a non-admin caller, so there's no control to show.
    expect(screen.queryByTestId('share-invite-role')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Assign new invites role before sharing the resource.')
    ).not.toBeInTheDocument();
  });

  it('sends the chosen invite_role with the SHARE commit', async () => {
    const user = userEvent.setup();
    mockAddGrant.mockResolvedValue(
      activeGrant({ id: 101, email: 'new@x.org', principal_id: null, status: 'pending' })
    );
    renderModal({}, { isAdmin: true });

    pasteIntoSearchInput('new@x.org');
    await user.click(screen.getByTestId('share-invite-role'));
    await user.click(screen.getByRole('option', { name: 'Analyst' }));
    await user.click(screen.getByTestId('share-commit-btn'));

    await waitFor(() => {
      expect(mockAddGrant).toHaveBeenCalledWith('dashboard', 1, {
        principal_type: 'user',
        email: 'new@x.org',
        permission: 'view',
        invite_role: 'analyst',
      });
    });
  });
});

describe('ShareModal — SHARE commit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends one POST per staged email at its pill permission and revalidates on mixed active/pending results', async () => {
    const user = userEvent.setup();
    const { mutate } = renderModal();

    pasteIntoSearchInput('active@x.org, pending@x.org');

    await user.click(screen.getByTestId('share-staged-permission-email-active@x.org'));
    await user.click(screen.getByRole('option', { name: 'Editor' }));

    mockAddGrant.mockImplementation(async (_rtype, _id, payload) => {
      if (payload.email === 'active@x.org') {
        return activeGrant({ id: 101, email: 'active@x.org', permission: 'edit' });
      }
      return activeGrant({
        id: 102,
        email: 'pending@x.org',
        principal_id: null,
        status: 'pending',
      });
    });

    await user.click(screen.getByTestId('share-commit-btn'));

    await waitFor(() => {
      expect(mockAddGrant).toHaveBeenCalledWith('dashboard', 1, {
        principal_type: 'user',
        email: 'active@x.org',
        permission: 'edit',
        invite_role: 'member',
      });
      expect(mockAddGrant).toHaveBeenCalledWith('dashboard', 1, {
        principal_type: 'user',
        email: 'pending@x.org',
        permission: 'view',
        invite_role: 'member',
      });
    });

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
      // Both rows cleared from the staged area — they now show as real rows.
      expect(screen.queryByTestId('share-staged-row-email-active@x.org')).not.toBeInTheDocument();
      expect(screen.queryByTestId('share-staged-row-email-pending@x.org')).not.toBeInTheDocument();
      expect(mockToastSuccess).toHaveBeenCalledWith('1 shared · 1 invited');
    });

    expect(trackEvent).toHaveBeenCalledWith(
      'sharing:email_invite_sent',
      expect.objectContaining({ entity_type: 'dashboard', count: 2 })
    );
  });

  it('retains a failed row for retry and surfaces a summary toast', async () => {
    const user = userEvent.setup();
    renderModal();

    pasteIntoSearchInput('ok@x.org, bad@x.org');

    mockAddGrant.mockImplementation(async (_rtype, _id, payload) => {
      if (payload.email === 'bad@x.org') {
        throw new Error('This resource cannot be shared with that email');
      }
      return activeGrant({ id: 200, email: 'ok@x.org' });
    });

    await user.click(screen.getByTestId('share-commit-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('share-staged-row-email-ok@x.org')).not.toBeInTheDocument();
      const failedRow = screen.getByTestId('share-staged-row-email-bad@x.org');
      expect(failedRow).toHaveAttribute('data-status', 'failed');
      expect(failedRow).toHaveTextContent('This resource cannot be shared with that email');
      expect(mockToastInfo).toHaveBeenCalledWith('1 shared · 1 failed');
    });

    // Retry: SHARE again resends the still-failed row.
    mockAddGrant.mockClear();
    mockAddGrant.mockResolvedValue(activeGrant({ id: 201, email: 'bad@x.org' }));
    await user.click(screen.getByTestId('share-commit-btn'));

    await waitFor(() => {
      expect(mockAddGrant).toHaveBeenCalledWith('dashboard', 1, {
        principal_type: 'user',
        email: 'bad@x.org',
        permission: 'view',
        invite_role: 'member',
      });
      expect(screen.queryByTestId('share-staged-row-email-bad@x.org')).not.toBeInTheDocument();
    });
  });

  it('sends a 7-email paste in small batches, never more than 5 concurrent requests', async () => {
    const user = userEvent.setup();
    renderModal();

    const emails = Array.from({ length: 7 }, (_, i) => `user${i}@x.org`);
    pasteIntoSearchInput(emails.join(', '));

    let inFlight = 0;
    let maxInFlight = 0;
    mockAddGrant.mockImplementation(
      async (_rtype: unknown, _id: unknown, payload: { email: string }) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight -= 1;
        return activeGrant({ id: emails.indexOf(payload.email) + 1, email: payload.email });
      }
    );

    await user.click(screen.getByTestId('share-commit-btn'));

    await waitFor(
      () => {
        expect(mockAddGrant).toHaveBeenCalledTimes(7);
      },
      { timeout: 3000 }
    );

    expect(maxInFlight).toBeLessThanOrEqual(5);
  });

  it('SHARE stays disabled with only invalid rows staged', async () => {
    const user = userEvent.setup();
    renderModal();

    pasteIntoSearchInput('not-an-email, also@bad');

    expect(screen.getByTestId('share-commit-btn')).toBeDisabled();
    await user.click(screen.getByTestId('share-commit-btn'));
    expect(mockAddGrant).not.toHaveBeenCalled();
  });
});

describe('ShareModal — pending grant rows (email invites)', () => {
  beforeEach(() => jest.clearAllMocks());

  const pendingGrant: AccessGrant = {
    id: 9,
    principal_type: 'user',
    principal_id: null,
    email: 'future@x.org',
    name: null,
    permission: 'view',
    status: 'pending',
  };

  it('removes a pending grant row the same way as an active one, via DELETE', async () => {
    const user = userEvent.setup();
    mockRemoveGrant.mockResolvedValue(undefined);
    const { mutate } = renderModal({ grants: [pendingGrant] });

    const row = screen.getByTestId('share-grant-row-9');
    expect(row).toHaveTextContent('future@x.org');
    expect(row).toHaveTextContent('invite pending');

    await user.click(screen.getByTestId('share-grant-remove-9'));

    await waitFor(() => {
      expect(mockRemoveGrant).toHaveBeenCalledWith('dashboard', 1, 9);
      expect(mutate).toHaveBeenCalled();
    });
  });

  it('changes a pending grant permission by re-POSTing via the email path', async () => {
    const user = userEvent.setup();
    mockAddGrant.mockResolvedValue({ ...pendingGrant, permission: 'edit' });
    const { mutate } = renderModal({ grants: [pendingGrant] });

    // The dropdown must render for pending rows, same as active ones.
    await user.click(screen.getByTestId('share-grant-permission-9'));
    await user.click(screen.getByRole('option', { name: 'Editor' }));

    await waitFor(() => {
      expect(mockAddGrant).toHaveBeenCalledWith('dashboard', 1, {
        principal_type: 'user',
        email: 'future@x.org',
        permission: 'edit',
      });
      expect(mutate).toHaveBeenCalled();
    });
  });
});
