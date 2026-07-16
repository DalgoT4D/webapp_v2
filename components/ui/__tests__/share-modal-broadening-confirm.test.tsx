/**
 * ShareModal — v1.1 M3b dashboard-broadening confirms:
 *
 *  1. Public-link enable: a `requires_confirmation` response renders the
 *     BroadeningConfirmDialog (charts named, CANCEL default); YES re-sends
 *     with `proceed`, CANCEL leaves the switch visually off (nothing was
 *     flipped server-side).
 *  2. SHARE commit: grants held behind the warning stay staged and get ONE
 *     aggregated prompt; YES re-sends each grant with its own
 *     extend_chart_ids + proceed; CANCEL keeps the rows staged.
 *
 * Both flows are driven purely by the response shape — no rtype branching.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareModal } from '@/components/ui/share-modal';
import {
  useResourceAccess,
  addGrant,
  type ResourceAccessOverview,
  type ChartCoverageVerdict,
  type GrantCreateResult,
} from '@/hooks/api/useResourceAccess';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useUserGroups } from '@/hooks/api/useUserGroups';
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

function verdict(overrides: Partial<ChartCoverageVerdict>): ChartCoverageVerdict {
  return {
    chart_id: 7,
    title: 'Salary Breakdown',
    covered: false,
    role_gaps: [],
    principal_gaps: [],
    public_exposure: false,
    extendable: false,
    viewer_can_edit: false,
    ...overrides,
  };
}

const baseOverview: ResourceAccessOverview = {
  resource_type: 'dashboard',
  resource_id: '1',
  capabilities: { general: true, grants: true, public_link: true, requests: true },
  owner: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
  general_access: { analyst_level: 'view', member_level: 'none' },
  grants: [],
  viewer: { effective_permission: 'edit', is_owner: true },
};

const mockOrgUsers = [
  { orguser_id: 42, email: 'new.person@ngo.org', new_role_slug: 'analyst' },
  { orguser_id: 43, email: 'ravi@ngo.org', new_role_slug: 'analyst' },
];

const mockGetShareStatus = jest
  .fn()
  .mockResolvedValue({ is_public: false, public_access_count: 0 });
const mockUpdateSharing = jest.fn();

function renderModal() {
  mockUseResourceAccess.mockReturnValue({
    data: baseOverview,
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
  mockUseUsers.mockReturnValue({ users: mockOrgUsers, isLoading: false });
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

  return render(
    <ShareModal
      entityId={1}
      entityLabel="Dashboard"
      entityType="dashboard"
      resourceName="Untitled Dashboard"
      isOpen
      onClose={jest.fn()}
      getShareStatus={mockGetShareStatus}
      updateSharing={mockUpdateSharing}
    />
  );
}

/** Type a query and press Enter to stage its single unambiguous user match. */
async function stageUser(user: ReturnType<typeof userEvent.setup>, query: string) {
  const input = screen.getByTestId('share-search-input');
  await user.clear(input);
  await user.type(input, query);
  await user.keyboard('{Enter}');
}

describe('ShareModal — public-toggle broadening confirm', () => {
  beforeEach(() => jest.clearAllMocks());

  const confirmationResponse = {
    is_public: false,
    public_access_count: 0,
    message: 'Confirmation required',
    requires_confirmation: true,
    under_covering_charts: [verdict({ public_exposure: true })],
  };

  it('renders the confirm (chart named, switch stays off); YES re-sends with proceed', async () => {
    mockUpdateSharing.mockResolvedValueOnce(confirmationResponse).mockResolvedValueOnce({
      is_public: true,
      public_url: 'https://dalgo.example/share/dashboard/tok',
      public_access_count: 0,
      message: 'Dashboard made public',
    });
    renderModal();

    await waitFor(() => expect(screen.getByTestId('share-toggle')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('share-toggle'));

    await waitFor(() =>
      expect(screen.getByTestId('broadening-confirm-dialog')).toBeInTheDocument()
    );
    expect(mockUpdateSharing).toHaveBeenCalledWith(1, { is_public: true });
    // Nothing flipped server-side — the switch must not show "on".
    expect(screen.getByTestId('share-toggle')).toHaveAttribute('data-state', 'unchecked');
    expect(screen.getByTestId('broadening-confirm-charts')).toHaveTextContent('Salary Breakdown');

    fireEvent.click(screen.getByTestId('broadening-confirm-yes'));

    await waitFor(() =>
      expect(mockUpdateSharing).toHaveBeenCalledWith(1, { is_public: true, proceed: true })
    );
    await waitFor(() =>
      expect(screen.getByTestId('share-toggle')).toHaveAttribute('data-state', 'checked')
    );
    expect(screen.queryByTestId('broadening-confirm-dialog')).not.toBeInTheDocument();
  });

  it('CANCEL reverts visually — no re-send, switch stays off', async () => {
    mockUpdateSharing.mockResolvedValueOnce(confirmationResponse);
    renderModal();

    await waitFor(() => expect(screen.getByTestId('share-toggle')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('share-toggle'));
    await waitFor(() =>
      expect(screen.getByTestId('broadening-confirm-dialog')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('broadening-confirm-cancel'));

    await waitFor(() =>
      expect(screen.queryByTestId('broadening-confirm-dialog')).not.toBeInTheDocument()
    );
    expect(mockUpdateSharing).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('share-toggle')).toHaveAttribute('data-state', 'unchecked');
  });
});

describe('ShareModal — SHARE commit aggregated broadening confirm', () => {
  beforeEach(() => jest.clearAllMocks());

  const salaryVerdict = verdict({
    chart_id: 7,
    title: 'Salary Breakdown',
    extendable: true,
    viewer_can_edit: true,
  });
  const visitsVerdict = verdict({
    chart_id: 8,
    title: 'Field Visits',
    extendable: true,
    viewer_can_edit: true,
  });

  function heldResponse(verdicts: ChartCoverageVerdict[]): GrantCreateResult {
    return { requires_confirmation: true, under_covering_charts: verdicts, grant: null };
  }

  function committedResponse(id: number, principalId: number): GrantCreateResult {
    return {
      requires_confirmation: false,
      under_covering_charts: [],
      grant: {
        id,
        principal_type: 'user',
        principal_id: principalId,
        email: 'x@ngo.org',
        name: null,
        permission: 'view',
        status: 'active',
      },
    };
  }

  it('aggregates held grants into ONE prompt naming every chart; YES re-sends each with its own extend ids', async () => {
    const user = userEvent.setup();
    mockAddGrant
      .mockResolvedValueOnce(heldResponse([salaryVerdict]))
      .mockResolvedValueOnce(heldResponse([visitsVerdict]))
      .mockResolvedValueOnce(committedResponse(201, 42))
      .mockResolvedValueOnce(committedResponse(202, 43));
    renderModal();

    await stageUser(user, 'new.person');
    await stageUser(user, 'ravi');
    expect(screen.getByTestId('share-staged-row-user-42')).toBeInTheDocument();
    expect(screen.getByTestId('share-staged-row-user-43')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('share-commit-btn'));

    // ONE aggregated prompt, union of both grants' charts.
    await waitFor(() =>
      expect(screen.getByTestId('broadening-confirm-dialog')).toBeInTheDocument()
    );
    const charts = screen.getByTestId('broadening-confirm-charts');
    expect(charts).toHaveTextContent('Salary Breakdown');
    expect(charts).toHaveTextContent('Field Visits');
    expect(mockAddGrant).toHaveBeenCalledTimes(2);
    // Held rows stay staged behind the dialog.
    expect(screen.getByTestId('share-staged-row-user-42')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('broadening-confirm-yes'));

    await waitFor(() => expect(mockAddGrant).toHaveBeenCalledTimes(4));
    expect(mockAddGrant).toHaveBeenNthCalledWith(3, 'dashboard', 1, {
      principal_type: 'user',
      principal_id: 42,
      permission: 'view',
      extend_chart_ids: [7],
      proceed: true,
    });
    expect(mockAddGrant).toHaveBeenNthCalledWith(4, 'dashboard', 1, {
      principal_type: 'user',
      principal_id: 43,
      permission: 'view',
      extend_chart_ids: [8],
      proceed: true,
    });
    // Committed rows leave the staging area; the dialog is gone.
    await waitFor(() =>
      expect(screen.queryByTestId('share-staged-row-user-42')).not.toBeInTheDocument()
    );
    expect(screen.queryByTestId('broadening-confirm-dialog')).not.toBeInTheDocument();
  });

  it('CANCEL keeps the rows staged and commits nothing', async () => {
    const user = userEvent.setup();
    mockAddGrant.mockResolvedValueOnce(heldResponse([salaryVerdict]));
    renderModal();

    await stageUser(user, 'new.person');
    fireEvent.click(screen.getByTestId('share-commit-btn'));
    await waitFor(() =>
      expect(screen.getByTestId('broadening-confirm-dialog')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('broadening-confirm-cancel'));

    await waitFor(() =>
      expect(screen.queryByTestId('broadening-confirm-dialog')).not.toBeInTheDocument()
    );
    expect(mockAddGrant).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('share-staged-row-user-42')).toBeInTheDocument();
  });
});
