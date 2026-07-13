/**
 * RequestAccessScreen — renders in place of the generic error state on a
 * 403 from a resource detail fetch. Covers: the request form, the
 * just-submitted success state, the already-pending state on revisit, and
 * the "already have access" 400 reload path.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequestAccessScreen } from '../request-access-screen';
import * as useAccessRequestsHook from '@/hooks/api/useAccessRequests';
import { TestWrapper } from '@/test-utils/render';

jest.mock('@/hooks/api/useAccessRequests', () => ({
  ...jest.requireActual('@/hooks/api/useAccessRequests'),
  useAccessRequests: jest.fn(),
  createAccessRequest: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({ toastError: { api: jest.fn() } }));

const mockUseAccessRequests = useAccessRequestsHook.useAccessRequests as jest.Mock;
const mockCreateAccessRequest = useAccessRequestsHook.createAccessRequest as jest.Mock;
const mockMutate = jest.fn();

function setupOutgoing(
  outgoing: useAccessRequestsHook.AccessRequestItem[] = [],
  isLoading = false
) {
  mockUseAccessRequests.mockReturnValue({
    incoming: [],
    outgoing,
    isLoading,
    isError: undefined,
    mutate: mockMutate,
  });
}

const renderScreen = (reloadPage?: () => void) =>
  render(
    <TestWrapper>
      <RequestAccessScreen
        rtype="dashboard"
        resourceId={7}
        resourceLabel="dashboard"
        reloadPage={reloadPage}
      />
    </TestWrapper>
  );

describe('RequestAccessScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupOutgoing();
  });

  it('shows the request form when there is no pending request', () => {
    renderScreen();

    expect(screen.getByText("You don't have access to this dashboard")).toBeInTheDocument();
    expect(screen.getByTestId('request-access-submit-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('request-access-pending-state')).not.toBeInTheDocument();
  });

  it('shows a loading state while the outgoing-requests check is in flight', () => {
    setupOutgoing([], true);
    renderScreen();

    expect(screen.getByTestId('request-access-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('request-access-submit-btn')).not.toBeInTheDocument();
  });

  it('shows the "Request pending" state on revisit when an outgoing pending request already exists', () => {
    setupOutgoing([
      {
        id: 12,
        resource_type: 'dashboard',
        resource_id: '7',
        requester: { orguser_id: 3, email: 'sarah@ngo.org', name: 'Sarah K' },
        requested_permission: 'edit',
        note: null,
        status: 'pending',
        decided_by: null,
        expires_at: '2026-08-11T09:00:00Z',
        created_at: '2026-07-12T09:00:00Z',
      },
    ]);
    renderScreen();

    expect(screen.getByText('Request pending')).toBeInTheDocument();
    expect(screen.getByText(/Edit access is waiting/)).toBeInTheDocument();
    expect(screen.queryByTestId('request-access-submit-btn')).not.toBeInTheDocument();
  });

  it('submits the requested permission and note, then shows the "Request sent" state', async () => {
    const user = userEvent.setup();
    mockCreateAccessRequest.mockResolvedValue({ id: 12, status: 'pending' });
    renderScreen();

    await user.click(screen.getByTestId('request-access-permission-edit'));
    await user.type(screen.getByTestId('request-access-note'), 'need this for the board report');
    await user.click(screen.getByTestId('request-access-submit-btn'));

    await waitFor(() => {
      expect(mockCreateAccessRequest).toHaveBeenCalledWith('dashboard', 7, {
        requested_permission: 'edit',
        note: 'need this for the board report',
      });
      expect(screen.getByText('Request sent')).toBeInTheDocument();
      expect(screen.getByText('The owner has been notified.')).toBeInTheDocument();
    });
  });

  it('reloads the page when the backend says the caller already has access', async () => {
    const user = userEvent.setup();
    mockCreateAccessRequest.mockRejectedValue(
      new Error('you already have access to this resource')
    );
    const reloadSpy = jest.fn();
    renderScreen(reloadSpy);

    await user.click(screen.getByTestId('request-access-submit-btn'));

    await waitFor(() => {
      expect(reloadSpy).toHaveBeenCalled();
    });
  });

  it('shows a generic error toast and keeps the form for a non-"already have access" failure', async () => {
    const user = userEvent.setup();
    const { toastError } = jest.requireMock('@/lib/toast');
    mockCreateAccessRequest.mockRejectedValue(new Error('Network error'));
    renderScreen();

    await user.click(screen.getByTestId('request-access-submit-btn'));

    await waitFor(() => {
      expect(toastError.api).toHaveBeenCalled();
    });
    expect(screen.getByTestId('request-access-submit-btn')).toBeInTheDocument();
    expect(screen.getByTestId('request-access-submit-btn')).not.toBeDisabled();
  });
});
