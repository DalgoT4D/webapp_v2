/**
 * NotificationsPage — compose a broadcast (whole platform / one org / several
 * orgs, admin-chosen channels), preview the combined recipient count, send, and
 * review the sent-broadcast history. Immediate send only: no scheduling, no
 * cancel (features/admin-portal/plan.md Milestone 2).
 *
 * The page is split into two tabs: "Create notification" (the composer) and
 * "View history" (the paginated table). The composer tab is forceMount-ed so an
 * unsent draft survives a peek at history — see the a11y test below for why that
 * needs an explicit `hidden` and cannot rely on forceMount alone.
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
import { FEATURES } from '@/constants/analytics';
import { DEFAULT_PAGE_SIZE } from '@/constants/notifications';

// The tab cases drive the composer AND a Radix Select in one flow, which is slow in
// jsdom; under a loaded parallel run they exceed jest's 5s default. This raises the
// time budget only — every assertion and expected value is unchanged.
jest.setTimeout(20000);

jest.mock('@/hooks/api/useAdminPortal');

const mockTrackFeatureView = jest.fn();
const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  trackFeatureView: (...args: unknown[]) => mockTrackFeatureView(...args),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

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
    totalCount: history.length,
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

/**
 * Render and let the composer's whole-platform recipient preview settle. Without
 * this its late setState lands outside act() and floods the log — the four composer
 * tests above already await the preview as part of what they assert.
 */
async function renderSettled() {
  render(<NotificationsPage />);
  await screen.findByText(/Reaches 5 people/);
}

describe('NotificationsPage tabs', () => {
  it('renders both tabs with the composer selected first', async () => {
    await renderSettled();

    expect(screen.getByTestId('notifications-tab-create')).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('notifications-tab-history')).toHaveAttribute(
      'data-state',
      'inactive'
    );
    expect(screen.getByTestId('broadcast-send')).toBeVisible();
  });

  it('does not render the history table until the history tab is opened', async () => {
    const user = userEvent.setup({ delay: null });
    await renderSettled();

    expect(screen.queryByTestId('notification-history-table')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('notifications-tab-history'));

    expect(await screen.findByTestId('notification-history-table')).toBeVisible();
  });

  it('does not fire a tab view on first render — navigation already reported it', async () => {
    await renderSettled();

    expect(mockTrackFeatureView).not.toHaveBeenCalled();
  });

  it('reports each tab switch under the admin_notifications feature', async () => {
    const user = userEvent.setup({ delay: null });
    await renderSettled();

    await user.click(screen.getByTestId('notifications-tab-history'));
    expect(mockTrackFeatureView).toHaveBeenCalledWith(FEATURES.ADMIN_NOTIFICATIONS, {
      tab: 'history',
    });

    await user.click(screen.getByTestId('notifications-tab-create'));
    expect(mockTrackFeatureView).toHaveBeenLastCalledWith(FEATURES.ADMIN_NOTIFICATIONS, {
      tab: 'create',
    });
    expect(mockTrackFeatureView).toHaveBeenCalledTimes(2);
  });

  it('keeps an unsent draft alive across a round-trip to history', async () => {
    const user = userEvent.setup({ delay: null });
    render(<NotificationsPage />);
    await waitFor(() => expect(mockPreviewRecipients).toHaveBeenCalledWith(undefined));

    await user.type(screen.getByTestId('broadcast-subject'), 'Half typed');
    await user.type(screen.getByTestId('broadcast-message'), 'Do not lose me');

    await user.click(screen.getByTestId('notifications-tab-history'));
    await user.click(screen.getByTestId('notifications-tab-create'));

    expect(screen.getByTestId('broadcast-subject')).toHaveValue('Half typed');
    expect(screen.getByTestId('broadcast-message')).toHaveValue('Do not lose me');
  });

  it('keeps the composer draft when a send fails, so nothing is retyped', async () => {
    mockSendNotification.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup({ delay: null });
    render(<NotificationsPage />);
    await waitFor(() => expect(mockPreviewRecipients).toHaveBeenCalledWith(undefined));

    await user.type(screen.getByTestId('broadcast-subject'), 'Subject');
    await user.type(screen.getByTestId('broadcast-message'), 'Hello everyone');
    await user.click(screen.getByTestId('broadcast-send'));

    await waitFor(() => expect(mockSendNotification).toHaveBeenCalled());
    expect(screen.getByTestId('broadcast-subject')).toHaveValue('Subject');
    expect(screen.getByTestId('broadcast-message')).toHaveValue('Hello everyone');
  });

  it('hides the still-mounted composer from the a11y tree while history is open', async () => {
    // Radix sets `hidden={!present}` on TabsContent, and forceMount pins `present`
    // permanently true — so forceMount ALONE leaves the inactive panel visible,
    // focusable (tabIndex=0) and exposed as a second role="tabpanel". The explicit
    // `hidden` is what actually hides it; this test fails if that prop is dropped.
    const user = userEvent.setup({ delay: null });
    await renderSettled();

    await user.click(screen.getByTestId('notifications-tab-history'));

    expect(screen.getByTestId('broadcast-send')).not.toBeVisible();
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });
});

describe('NotificationsPage history paging', () => {
  /** The history table only renders once its tab is open. */
  async function openHistory(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByTestId('notifications-tab-history'));
    return screen.findByTestId('notification-history-table');
  }

  it('requests the first page at the default page size', async () => {
    await renderSettled();

    expect(useAdminPortal.useAdminNotifications).toHaveBeenCalledWith(1, DEFAULT_PAGE_SIZE);
  });

  it('refetches with the next page number when next is clicked', async () => {
    (useAdminPortal.useAdminNotifications as jest.Mock).mockReturnValue({
      notifications: history,
      totalCount: 42,
      isLoading: false,
      mutate: mockMutateHistory,
    });
    const user = userEvent.setup({ delay: null });
    await renderSettled();
    await openHistory(user);

    await user.click(screen.getByTestId('next-page-btn'));

    await waitFor(() =>
      expect(useAdminPortal.useAdminNotifications).toHaveBeenLastCalledWith(2, DEFAULT_PAGE_SIZE)
    );
  });

  it('returns to the first page when the page size changes', async () => {
    (useAdminPortal.useAdminNotifications as jest.Mock).mockReturnValue({
      notifications: history,
      totalCount: 42,
      isLoading: false,
      mutate: mockMutateHistory,
    });
    const user = userEvent.setup({ delay: null });
    await renderSettled();
    await openHistory(user);

    await user.click(screen.getByTestId('next-page-btn'));
    await waitFor(() =>
      expect(useAdminPortal.useAdminNotifications).toHaveBeenLastCalledWith(2, DEFAULT_PAGE_SIZE)
    );

    await user.click(screen.getByTestId('page-size-select'));
    await user.click(await screen.findByRole('option', { name: '50' }));

    await waitFor(() =>
      expect(useAdminPortal.useAdminNotifications).toHaveBeenLastCalledWith(1, 50)
    );
  });

  it('returns to the first page after a send, since the new row shifts every page', async () => {
    (useAdminPortal.useAdminNotifications as jest.Mock).mockReturnValue({
      notifications: history,
      totalCount: 42,
      isLoading: false,
      mutate: mockMutateHistory,
    });
    mockSendNotification.mockResolvedValueOnce({ id: 99, recipient_count: 5 });
    const user = userEvent.setup({ delay: null });
    await renderSettled();

    await openHistory(user);
    await user.click(screen.getByTestId('next-page-btn'));
    await waitFor(() =>
      expect(useAdminPortal.useAdminNotifications).toHaveBeenLastCalledWith(2, DEFAULT_PAGE_SIZE)
    );

    await user.click(screen.getByTestId('notifications-tab-create'));
    await user.type(screen.getByTestId('broadcast-subject'), 'Subject');
    await user.type(screen.getByTestId('broadcast-message'), 'Hello everyone');
    await user.click(screen.getByTestId('broadcast-send'));

    await waitFor(() =>
      expect(useAdminPortal.useAdminNotifications).toHaveBeenLastCalledWith(1, DEFAULT_PAGE_SIZE)
    );
    expect(mockMutateHistory).toHaveBeenCalled();
  });
});
