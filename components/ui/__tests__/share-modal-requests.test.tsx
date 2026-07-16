/**
 * ShareModal — in-modal request decisions (Milestone 9). `incoming` from
 * GET /api/access/requests/ is already filtered server-side to requests the
 * caller can decide (owner/admin) — the modal only narrows it to requests
 * on THIS resource and renders Approve/Decline, no extra permission check.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareModal } from '@/components/ui/share-modal';
import { useResourceAccess, type ResourceAccessOverview } from '@/hooks/api/useResourceAccess';
import {
  useAccessRequests,
  approveAccessRequest,
  declineAccessRequest,
  type AccessRequestItem,
} from '@/hooks/api/useAccessRequests';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useRbac } from '@/lib/rbac';
import { trackEvent } from '@/lib/analytics';

jest.mock('@/hooks/api/useResourceAccess');
jest.mock('@/hooks/api/useAccessRequests');
jest.mock('@/hooks/api/useUserManagement');
jest.mock('@/lib/rbac', () => ({ ...jest.requireActual('@/lib/rbac'), useRbac: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastError: { share: jest.fn(), load: jest.fn(), api: jest.fn() },
}));
jest.mock('@/lib/clipboard', () => ({
  copyUrlToClipboard: jest.fn().mockResolvedValue(undefined),
}));

const mockUseResourceAccess = useResourceAccess as jest.Mock;
const mockUseAccessRequests = useAccessRequests as jest.Mock;
const mockUseUsers = useUsers as jest.Mock;
const mockUseRbac = useRbac as jest.Mock;
const mockApproveAccessRequest = approveAccessRequest as jest.Mock;
const mockDeclineAccessRequest = declineAccessRequest as jest.Mock;

const baseOverview: ResourceAccessOverview = {
  resource_type: 'dashboard',
  resource_id: '1',
  capabilities: { general: true, grants: true, public_link: true, requests: true },
  owner: { orguser_id: 1, email: 'asha@ngo.org', name: 'Asha Kumar' },
  general_access: { analyst_level: 'view', member_level: 'none' },
  grants: [],
  viewer: { effective_permission: 'edit', is_owner: false },
};

const viewRequest: AccessRequestItem = {
  id: 12,
  resource_type: 'dashboard',
  resource_id: '1',
  requester: { orguser_id: 3, email: 'sarah@ngo.org', name: 'Sarah K' },
  requested_permission: 'view',
  note: 'need this for the board report',
  status: 'pending',
  decided_by: null,
  expires_at: '2026-08-11T09:00:00Z',
  created_at: '2026-07-12T09:00:00Z',
};

const editRequest: AccessRequestItem = {
  ...viewRequest,
  id: 13,
  requester: { orguser_id: 4, email: 'ravi@ngo.org', name: 'Ravi P' },
  requested_permission: 'edit',
  note: null,
};

const mockGetShareStatus = jest
  .fn()
  .mockResolvedValue({ is_public: false, public_access_count: 0 });
const mockUpdateSharing = jest.fn();
const mockMutateAccessRequests = jest.fn();

function renderModal(incoming: AccessRequestItem[] = []) {
  mockUseResourceAccess.mockReturnValue({
    data: baseOverview,
    isLoading: false,
    isError: undefined,
    mutate: jest.fn(),
  });
  mockUseAccessRequests.mockReturnValue({
    incoming,
    outgoing: [],
    isLoading: false,
    isError: undefined,
    mutate: mockMutateAccessRequests,
  });
  mockUseUsers.mockReturnValue({ users: [], isLoading: false });
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
      isOpen
      onClose={jest.fn()}
      getShareStatus={mockGetShareStatus}
      updateSharing={mockUpdateSharing}
    />
  );
}

describe('ShareModal — Pending requests', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is absent when there are no decidable requests for this resource', () => {
    renderModal([]);
    expect(screen.queryByTestId('share-requests-section')).not.toBeInTheDocument();
  });

  it('is absent when incoming has requests for a different resource', () => {
    renderModal([{ ...viewRequest, resource_id: '999' }]);
    expect(screen.queryByTestId('share-requests-section')).not.toBeInTheDocument();
  });

  it('renders requester, requested permission (bolded), and note for a matching request', () => {
    renderModal([viewRequest]);
    const row = screen.getByTestId('share-request-row-12');
    expect(row).toHaveTextContent('Sarah K');
    expect(row).toHaveTextContent('wants to view');
    expect(row).toHaveTextContent('need this for the board report');
  });

  it('caps the permission choice at the requested level — a View request offers no Edit option', () => {
    renderModal([viewRequest]);
    // Single-option requests render a static bolded word, not a Select, so
    // there's nothing to click into an escalated choice at all.
    expect(screen.queryByTestId('share-request-permission-12')).not.toBeInTheDocument();
    expect(screen.getByTestId('share-request-row-12')).toHaveTextContent('wants to view');
  });

  it('offers a downgrade choice (Edit default, View option) for an Edit request', async () => {
    const user = userEvent.setup();
    renderModal([editRequest]);

    const permissionSelect = screen.getByTestId('share-request-permission-13');
    expect(permissionSelect).toHaveTextContent('edit');

    await user.click(permissionSelect);
    expect(screen.getByRole('option', { name: 'view' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'edit' })).toBeInTheDocument();
  });

  it('approves at the requested level (no permission override) when the default is kept', async () => {
    const user = userEvent.setup();
    mockApproveAccessRequest.mockResolvedValue({ ...viewRequest, status: 'approved' });
    renderModal([viewRequest]);

    await user.click(screen.getByTestId('share-request-approve-12'));

    await waitFor(() => {
      expect(mockApproveAccessRequest).toHaveBeenCalledWith(12, undefined);
      expect(mockMutateAccessRequests).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith(
        'sharing:access_request_approved',
        expect.objectContaining({ entity_type: 'dashboard', downgraded: false })
      );
    });
  });

  it('approves with the downgraded permission when the owner picks View on an Edit request', async () => {
    const user = userEvent.setup();
    mockApproveAccessRequest.mockResolvedValue({ ...editRequest, status: 'approved' });
    renderModal([editRequest]);

    await user.click(screen.getByTestId('share-request-permission-13'));
    await user.click(screen.getByRole('option', { name: 'view' }));
    await user.click(screen.getByTestId('share-request-approve-13'));

    await waitFor(() => {
      expect(mockApproveAccessRequest).toHaveBeenCalledWith(13, 'view');
      expect(trackEvent).toHaveBeenCalledWith(
        'sharing:access_request_approved',
        expect.objectContaining({ entity_type: 'dashboard', downgraded: true })
      );
    });
  });

  it('declines a request', async () => {
    const user = userEvent.setup();
    mockDeclineAccessRequest.mockResolvedValue({ ...viewRequest, status: 'declined' });
    renderModal([viewRequest]);

    await user.click(screen.getByTestId('share-request-decline-12'));

    await waitFor(() => {
      expect(mockDeclineAccessRequest).toHaveBeenCalledWith(12);
      expect(mockMutateAccessRequests).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith(
        'sharing:access_request_declined',
        expect.objectContaining({ entity_type: 'dashboard' })
      );
    });
  });

  it('renders a row per matching request when there are several', () => {
    renderModal([viewRequest, editRequest]);
    expect(screen.getByTestId('share-request-row-12')).toBeInTheDocument();
    expect(screen.getByTestId('share-request-row-13')).toBeInTheDocument();
  });

  it('shows a "{N} users are requesting access" header for 2+ pending requests (design frame 1353:14586)', () => {
    renderModal([viewRequest, editRequest]);
    expect(screen.getByTestId('share-requests-count-header')).toHaveTextContent(
      '2 users are requesting access'
    );
  });

  it('shows no count header for a single pending request', () => {
    renderModal([viewRequest]);
    expect(screen.queryByTestId('share-requests-count-header')).not.toBeInTheDocument();
  });

  it('shows a plain-text Deny button before the filled Approve button (design: "request on sharing")', () => {
    renderModal([viewRequest]);
    const row = screen.getByTestId('share-request-row-12');
    const deny = screen.getByTestId('share-request-decline-12');
    const approve = screen.getByTestId('share-request-approve-12');
    expect(deny).toHaveTextContent('Deny');
    expect(approve).toHaveTextContent('Approve');
    // Deny sits to the left of Approve in DOM order.
    expect(row.compareDocumentPosition(deny) & Node.DOCUMENT_POSITION_PRECEDING).toBeFalsy();
    expect(deny.compareDocumentPosition(approve) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('collapses and re-expands the request rows via the header chevron, defaulting to expanded', async () => {
    const user = userEvent.setup();
    renderModal([viewRequest, editRequest]);

    expect(screen.getByTestId('share-request-row-12')).toBeInTheDocument();

    await user.click(screen.getByTestId('share-requests-count-header'));
    expect(screen.queryByTestId('share-request-row-12')).not.toBeInTheDocument();
    expect(screen.queryByTestId('share-request-row-13')).not.toBeInTheDocument();
    // The header itself stays visible while collapsed.
    expect(screen.getByTestId('share-requests-count-header')).toBeInTheDocument();

    await user.click(screen.getByTestId('share-requests-count-header'));
    expect(screen.getByTestId('share-request-row-12')).toBeInTheDocument();
    expect(screen.getByTestId('share-request-row-13')).toBeInTheDocument();
  });
});
