/**
 * ShareModal tests for the multi-email invite path in the "Add a person"
 * area (Milestone 4 frontend). Backend contract (task-09): POST
 * .../grants/ with {principal_type:'user', email, permission} resolves to
 * an instant active grant for a known org email, or a Member invitation +
 * pending grant for an unknown one — the response `status` tells us which.
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

function renderModal(overrides: Partial<ResourceAccessOverview> = {}) {
  const mutate = jest.fn();
  mockUseResourceAccess.mockReturnValue({
    data: { ...baseOverview, ...overrides },
    isLoading: false,
    isError: undefined,
    mutate,
  });
  mockUseUsers.mockReturnValue({ users: [], isLoading: false });
  mockUseUserGroups.mockReturnValue({
    data: [],
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
      onClose={jest.fn()}
      getShareStatus={mockGetShareStatus}
      updateSharing={mockUpdateSharing}
    />
  );

  return { mutate };
}

function pasteIntoEmailInput(text: string) {
  const input = screen.getByTestId('share-add-email-input');
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

describe('ShareModal — email invite mode toggle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the org-member picker by default and switches to the email panel', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByTestId('share-add-person-combobox-input')).toBeInTheDocument();
    expect(screen.queryByTestId('share-add-email-panel')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('share-add-mode-email'));

    expect(screen.getByTestId('share-add-email-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('share-add-person-combobox-input')).not.toBeInTheDocument();
  });

  it('renders the "New people will join as Members" hint only in email mode', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.queryByTestId('share-add-email-hint')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('share-add-mode-email'));

    expect(screen.getByTestId('share-add-email-hint')).toHaveTextContent(
      'New people will join as Members'
    );
  });
});

describe('ShareModal — email invite parsing', () => {
  beforeEach(() => jest.clearAllMocks());

  it('parses a paste of comma/newline-separated emails into valid + error chips', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId('share-add-mode-email'));

    pasteIntoEmailInput('a@x.org, b@x.org\nbad-email');

    expect(screen.getByTestId('share-add-email-chip-a@x.org')).toBeInTheDocument();
    expect(screen.getByTestId('share-add-email-chip-b@x.org')).toBeInTheDocument();
    const badChip = screen.getByTestId('share-add-email-chip-bad-email');
    expect(badChip).toBeInTheDocument();
    expect(badChip).toHaveAttribute('data-status', 'invalid');
  });

  it('dedups the same email pasted twice, case-insensitively', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId('share-add-mode-email'));

    pasteIntoEmailInput('a@x.org, A@X.ORG');

    expect(screen.getAllByTestId('share-add-email-chip-a@x.org')).toHaveLength(1);
  });
});

describe('ShareModal — email invite send', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends one POST per valid email at the selected permission and revalidates on mixed active/pending results', async () => {
    const user = userEvent.setup();
    const { mutate } = renderModal();
    await user.click(screen.getByTestId('share-add-mode-email'));

    pasteIntoEmailInput('active@x.org, pending@x.org');

    await user.click(screen.getByTestId('share-add-email-permission'));
    await user.click(screen.getByRole('option', { name: 'Editor' }));

    mockAddGrant.mockImplementation(async (_rtype, _id, payload) => {
      if (payload.email === 'active@x.org') {
        return activeGrant({
          id: 101,
          email: 'active@x.org',
          permission: 'edit',
          status: 'active',
        });
      }
      return activeGrant({
        id: 102,
        email: 'pending@x.org',
        principal_id: null,
        permission: 'edit',
        status: 'pending',
      });
    });

    await user.click(screen.getByTestId('share-add-email-btn'));

    await waitFor(() => {
      expect(mockAddGrant).toHaveBeenCalledWith('dashboard', 1, {
        principal_type: 'user',
        email: 'active@x.org',
        permission: 'edit',
      });
      expect(mockAddGrant).toHaveBeenCalledWith('dashboard', 1, {
        principal_type: 'user',
        email: 'pending@x.org',
        permission: 'edit',
      });
    });

    await waitFor(() => {
      expect(mutate).toHaveBeenCalled();
      // Both chips are gone from the invite panel — they now show as real rows.
      expect(screen.queryByTestId('share-add-email-chip-active@x.org')).not.toBeInTheDocument();
      expect(screen.queryByTestId('share-add-email-chip-pending@x.org')).not.toBeInTheDocument();
      expect(mockToastSuccess).toHaveBeenCalledWith('1 shared · 1 invited');
    });

    expect(trackEvent).toHaveBeenCalledWith(
      'sharing:email_invite_sent',
      expect.objectContaining({ entity_type: 'dashboard', count: 2 })
    );
  });

  it('retains a failed chip for retry and surfaces a summary toast', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId('share-add-mode-email'));

    pasteIntoEmailInput('ok@x.org, bad@x.org');

    mockAddGrant.mockImplementation(async (_rtype, _id, payload) => {
      if (payload.email === 'bad@x.org') {
        throw new Error('This resource cannot be shared with that email');
      }
      return activeGrant({ id: 200, email: 'ok@x.org', status: 'active' });
    });

    await user.click(screen.getByTestId('share-add-email-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('share-add-email-chip-ok@x.org')).not.toBeInTheDocument();
      const failedChip = screen.getByTestId('share-add-email-chip-bad@x.org');
      expect(failedChip).toHaveAttribute('data-status', 'failed');
      expect(mockToastInfo).toHaveBeenCalledWith('1 shared · 1 failed');
    });

    // Retry: clicking Invite again resends the still-failed chip.
    mockAddGrant.mockClear();
    mockAddGrant.mockResolvedValue(activeGrant({ id: 201, email: 'bad@x.org', status: 'active' }));
    await user.click(screen.getByTestId('share-add-email-btn'));

    await waitFor(() => {
      expect(mockAddGrant).toHaveBeenCalledWith('dashboard', 1, {
        principal_type: 'user',
        email: 'bad@x.org',
        permission: 'view',
      });
      expect(screen.queryByTestId('share-add-email-chip-bad@x.org')).not.toBeInTheDocument();
    });
  });

  it('sends a 7-email paste in small batches, never more than 5 concurrent requests', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId('share-add-mode-email'));

    const emails = Array.from({ length: 7 }, (_, i) => `user${i}@x.org`);
    pasteIntoEmailInput(emails.join(', '));

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

    await user.click(screen.getByTestId('share-add-email-btn'));

    await waitFor(
      () => {
        expect(mockAddGrant).toHaveBeenCalledTimes(7);
      },
      { timeout: 3000 }
    );

    expect(maxInFlight).toBeLessThanOrEqual(5);
  });

  it('the Invite button stays disabled with only invalid chips present', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId('share-add-mode-email'));

    pasteIntoEmailInput('not-an-email');

    expect(screen.getByTestId('share-add-email-btn')).toBeDisabled();
    expect(mockAddGrant).not.toHaveBeenCalled();
  });
});

describe('ShareModal — pending grant removal (email invite chips)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('removes a pending grant row the same way as an active one, via DELETE', async () => {
    const user = userEvent.setup();
    mockRemoveGrant.mockResolvedValue(undefined);
    const { mutate } = renderModal({
      grants: [
        {
          id: 9,
          principal_type: 'user',
          principal_id: null,
          email: 'future@x.org',
          name: null,
          permission: 'view',
          status: 'pending',
        },
      ],
    });

    const row = screen.getByTestId('share-grant-row-9');
    expect(row).toHaveTextContent('future@x.org');
    expect(row).toHaveTextContent('invite pending');

    await user.click(screen.getByTestId('share-grant-remove-9'));

    await waitFor(() => {
      expect(mockRemoveGrant).toHaveBeenCalledWith('dashboard', 1, 9);
      expect(mutate).toHaveBeenCalled();
    });
  });
});
