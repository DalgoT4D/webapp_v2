/**
 * NotificationRow inline Approve/Deny on an access-request notification.
 * Only access-request notifications carry `metadata`; every other
 * notification renders as plain text (covered by NotificationRow.test.tsx).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationRow } from '../NotificationRow';
import { createMockNotification } from './notification-mock-data';
import { approveAccessRequest, declineAccessRequest } from '@/hooks/api/useAccessRequests';
import { trackEvent } from '@/lib/analytics';
import { toastError, toastSuccess } from '@/lib/toast';
import type { AccessRequestNotificationMetadata } from '@/types/notifications';

jest.mock('@/hooks/api/useAccessRequests', () => ({
  ...jest.requireActual('@/hooks/api/useAccessRequests'),
  approveAccessRequest: jest.fn(),
  declineAccessRequest: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastError: { api: jest.fn() },
}));
jest.mock('swr', () => ({ mutate: jest.fn() }));

const mockApprove = approveAccessRequest as jest.Mock;
const mockDecline = declineAccessRequest as jest.Mock;

const accessRequestMetadata: AccessRequestNotificationMetadata = {
  kind: 'access_request',
  request_id: 42,
  resource_type: 'dashboard',
  resource_name: 'Sales Overview',
  requester_email: 'priya@ngo.org',
  requested_permission: 'edit',
};

function renderRow(overrides: Parameters<typeof createMockNotification>[0] = {}) {
  const notification = createMockNotification({
    message: 'priya@ngo.org has requested edit access for the resource Sales Overview',
    metadata: accessRequestMetadata,
    ...overrides,
  });
  return render(
    <table>
      <tbody>
        <NotificationRow
          notification={notification}
          isSelected={false}
          isExpanded={false}
          onSelect={jest.fn()}
          onToggleExpand={jest.fn()}
        />
      </tbody>
    </table>
  );
}

describe('NotificationRow — access-request payload', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders Deny and Approve buttons when the notification carries an access-request payload', () => {
    renderRow();
    expect(screen.getByTestId('notification-approve-btn-1')).toBeInTheDocument();
    expect(screen.getByTestId('notification-deny-btn-1')).toBeInTheDocument();
  });

  it('does not render action buttons for a notification without a payload', () => {
    renderRow({ metadata: null });
    expect(screen.queryByTestId('notification-approve-btn-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notification-deny-btn-1')).not.toBeInTheDocument();
  });

  it('does not render action buttons when metadata is absent entirely', () => {
    renderRow({ metadata: undefined });
    expect(screen.queryByTestId('notification-approve-btn-1')).not.toBeInTheDocument();
  });

  it('approves at the requested permission and updates the row in place', async () => {
    const user = userEvent.setup();
    mockApprove.mockResolvedValue({ id: 42, status: 'approved' });
    renderRow();

    await user.click(screen.getByTestId('notification-approve-btn-1'));

    await waitFor(() => {
      expect(mockApprove).toHaveBeenCalledWith(42);
      expect(screen.getByTestId('notification-decision-1')).toHaveTextContent('Approved');
    });
    expect(screen.queryByTestId('notification-approve-btn-1')).not.toBeInTheDocument();
    expect(toastSuccess.generic).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      'sharing:access_request_approved',
      expect.objectContaining({ entity_type: 'dashboard', source: 'notification_row' })
    );
  });

  it('denies the request and updates the row in place', async () => {
    const user = userEvent.setup();
    mockDecline.mockResolvedValue({ id: 42, status: 'declined' });
    renderRow();

    await user.click(screen.getByTestId('notification-deny-btn-1'));

    await waitFor(() => {
      expect(mockDecline).toHaveBeenCalledWith(42);
      expect(screen.getByTestId('notification-decision-1')).toHaveTextContent('Denied');
    });
    expect(toastSuccess.generic).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      'sharing:access_request_declined',
      expect.objectContaining({ entity_type: 'dashboard', source: 'notification_row' })
    );
  });

  it('shows an already-resolved state without crashing when the request was decided elsewhere', async () => {
    const user = userEvent.setup();
    mockApprove.mockRejectedValue(new Error('this request has already been approved'));
    renderRow();

    await user.click(screen.getByTestId('notification-approve-btn-1'));

    await waitFor(() => {
      expect(screen.getByTestId('notification-decision-1')).toBeInTheDocument();
    });
    expect(toastError.api).not.toHaveBeenCalled();
    expect(screen.queryByTestId('notification-approve-btn-1')).not.toBeInTheDocument();
  });

  it('shows an already-resolved state when the request has expired', async () => {
    const user = userEvent.setup();
    mockDecline.mockRejectedValue(new Error('this request has expired'));
    renderRow();

    await user.click(screen.getByTestId('notification-deny-btn-1'));

    await waitFor(() => {
      expect(screen.getByTestId('notification-decision-1')).toBeInTheDocument();
    });
    expect(toastError.api).not.toHaveBeenCalled();
  });

  it('shows a generic error toast and keeps the buttons for any other failure', async () => {
    const user = userEvent.setup();
    mockApprove.mockRejectedValue(new Error('Network error'));
    renderRow();

    await user.click(screen.getByTestId('notification-approve-btn-1'));

    await waitFor(() => {
      expect(toastError.api).toHaveBeenCalled();
    });
    expect(screen.getByTestId('notification-approve-btn-1')).toBeInTheDocument();
  });
});
