/**
 * NotificationsPage — compose a broadcast (whole platform / one org / several
 * orgs, admin-chosen channels), preview the combined recipient count, send, and
 * review the sent-broadcast history. Immediate send only: no scheduling, no
 * cancel (features/admin-portal/plan.md Milestone 2).
 *
 * userEvent is set up with `delay: null`: the composer is the most type-heavy screen
 * in the portal (subject + message), and the default per-keystroke delay pushed these
 * tests past the 5s timeout under a loaded parallel run. It removes simulated typing
 * latency only — no assertion or expected value is relaxed.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationsPage from '@/app/admin/notifications/page';
import * as useAdminPortal from '@/hooks/api/useAdminPortal';
import type { AdminOrg } from '@/hooks/api/useAdminPortal';

jest.mock('@/hooks/api/useAdminPortal');

const orgs: AdminOrg[] = [
  { id: 1, name: 'Akshara', slug: 'akshara', viz_url: null, base_plan: 'Dalgo', user_count: 5 },
  { id: 2, name: 'Bhumi', slug: 'bhumi', viz_url: null, base_plan: 'Free Trial', user_count: 2 },
];

const history = [
  {
    id: 10,
    message: 'Past broadcast',
    urgent: false,
    timestamp: '2026-08-20T00:00:00Z',
    sent_time: '2026-08-20T00:00:01Z',
    target_org_names: ['Akshara'],
    send_in_app: true,
    send_email: false,
    recipient_count: 4,
  },
];

const mockPreviewRecipients = jest.fn();
const mockSendNotification = jest.fn();
const mockMutateHistory = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAdminPortal.useAdminOrgs as jest.Mock).mockReturnValue({ orgs, isLoading: false });
  (useAdminPortal.useAdminNotifications as jest.Mock).mockReturnValue({
    notifications: history,
    isLoading: false,
    mutate: mockMutateHistory,
  });
  (useAdminPortal.useAdminNotificationActions as jest.Mock).mockReturnValue({
    previewRecipients: mockPreviewRecipients,
    sendNotification: mockSendNotification,
  });
  mockPreviewRecipients.mockResolvedValue({ recipient_count: 5 });
});

describe('NotificationsPage composer', () => {
  it('previews the whole-platform audience by default and enables send once resolved', async () => {
    render(<NotificationsPage />);

    await waitFor(() => expect(mockPreviewRecipients).toHaveBeenCalledWith(undefined));
    expect(await screen.findByText(/Reaches 5 people/)).toBeInTheDocument();

    const user = userEvent.setup({ delay: null });
    await user.type(screen.getByTestId('broadcast-subject'), 'Subject');
    await user.type(screen.getByTestId('broadcast-message'), 'Hello everyone');

    expect(screen.getByTestId('broadcast-send')).not.toBeDisabled();
  });

  it('blocks send until the preview count has resolved', () => {
    mockPreviewRecipients.mockReturnValue(new Promise(() => {})); // never resolves
    render(<NotificationsPage />);

    expect(screen.getByTestId('broadcast-send')).toBeDisabled();
  });

  it('switching to one-or-more-orgs re-previews with the selected org_ids', async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationsPage />);
    await waitFor(() => expect(mockPreviewRecipients).toHaveBeenCalledWith(undefined));
    mockPreviewRecipients.mockClear();
    mockPreviewRecipients.mockResolvedValue({ recipient_count: 2 });

    await user.click(screen.getByLabelText(/one or more organizations/i));
    await user.click(screen.getByTestId('broadcast-org-picker-search'));
    const listbox = await screen.findByTestId('broadcast-org-picker-listbox');
    await user.click(await within(listbox).findByText('Akshara'));

    await waitFor(() => expect(mockPreviewRecipients).toHaveBeenCalledWith([1]));
    expect(await screen.findByText(/Reaches 2 people/)).toBeInTheDocument();
  });

  it('sends with the composed payload and refreshes history', async () => {
    mockSendNotification.mockResolvedValueOnce({ id: 99, recipient_count: 5 });
    const user = userEvent.setup({ delay: null });
    render(<NotificationsPage />);
    await waitFor(() => expect(mockPreviewRecipients).toHaveBeenCalledWith(undefined));

    await user.type(screen.getByTestId('broadcast-subject'), 'Subject');
    await user.type(screen.getByTestId('broadcast-message'), 'Hello everyone');
    await user.click(screen.getByTestId('broadcast-send'));

    await waitFor(() =>
      expect(mockSendNotification).toHaveBeenCalledWith({
        message: 'Hello everyone',
        email_subject: 'Subject',
        urgent: false,
        org_ids: undefined,
        send_in_app: true,
        send_email: true,
      })
    );
    await waitFor(() => expect(mockMutateHistory).toHaveBeenCalled());
  });
});

describe('NotificationsPage history', () => {
  it('shows past broadcasts with audience, channels, and recipient count', () => {
    render(<NotificationsPage />);

    const row = screen.getByTestId('notification-history-row-10');
    expect(row).toHaveTextContent('Past broadcast');
    expect(row).toHaveTextContent('Akshara');
    expect(row).toHaveTextContent('In-app');
    expect(row).toHaveTextContent('4');
  });

  it('labels a null audience as whole platform', () => {
    (useAdminPortal.useAdminNotifications as jest.Mock).mockReturnValue({
      notifications: [{ ...history[0], target_org_names: null }],
      isLoading: false,
      mutate: mockMutateHistory,
    });
    render(<NotificationsPage />);

    expect(screen.getByTestId('notification-history-row-10')).toHaveTextContent('Whole platform');
  });
});
