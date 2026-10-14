/**
 * BroadcastHistory — the "View history" tab: one page of sent broadcasts.
 *
 * Presentational, like NotificationsList: the page owns page/pageSize and the
 * fetch, so these tests drive it purely through props. The page-state wiring (which
 * page/limit actually gets requested) is covered in
 * app/admin/notifications/__tests__/page.test.tsx.
 *
 * The first two cases moved here verbatim from that page test when the page was
 * split into tabs — same assertions, now against the component that owns the table.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BroadcastHistory } from '@/components/admin/BroadcastHistory';
import type { AdminNotification } from '@/hooks/api/useAdminPortal';

const history: AdminNotification[] = [
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

const onPageChange = jest.fn();
const onPageSizeChange = jest.fn();

function renderHistory(overrides: Partial<React.ComponentProps<typeof BroadcastHistory>> = {}) {
  return render(
    <BroadcastHistory
      notifications={history}
      totalCount={history.length}
      page={1}
      pageSize={10}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      isLoading={false}
      {...overrides}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BroadcastHistory table', () => {
  it('shows past broadcasts with audience, channels, and recipient count', () => {
    renderHistory();

    const row = screen.getByTestId('notification-history-row-10');
    expect(row).toHaveTextContent('Past broadcast');
    expect(row).toHaveTextContent('Akshara');
    expect(row).toHaveTextContent('In-app');
    expect(row).toHaveTextContent('4');
  });

  it('labels a null audience as whole platform', () => {
    renderHistory({ notifications: [{ ...history[0], target_org_names: null }] });

    expect(screen.getByTestId('notification-history-row-10')).toHaveTextContent('Whole platform');
  });

  it('shows a skeleton while a page is loading', () => {
    renderHistory({ notifications: [], totalCount: 0, isLoading: true });

    expect(screen.getByTestId('notification-history-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('notification-history-table')).not.toBeInTheDocument();
  });
});

describe('BroadcastHistory pagination', () => {
  it('reports the server-side total, not just the rows on this page', () => {
    renderHistory({ totalCount: 42 });

    expect(screen.getByText('1–10 of 42')).toBeInTheDocument();
    expect(screen.getByText('1 of 5')).toBeInTheDocument();
  });

  it('asks for the next page when next is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    renderHistory({ totalCount: 42 });

    await user.click(screen.getByTestId('next-page-btn'));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables prev on the first page', () => {
    renderHistory({ totalCount: 42 });

    expect(screen.getByTestId('prev-page-btn')).toBeDisabled();
    expect(screen.getByTestId('next-page-btn')).not.toBeDisabled();
  });

  it('disables next on the last page', () => {
    renderHistory({ totalCount: 42, page: 5 });

    expect(screen.getByTestId('next-page-btn')).toBeDisabled();
    expect(screen.getByTestId('prev-page-btn')).not.toBeDisabled();
    expect(screen.getByText('41–42 of 42')).toBeInTheDocument();
  });

  it('reports a new page size', async () => {
    const user = userEvent.setup({ delay: null });
    renderHistory({ totalCount: 42 });

    await user.click(screen.getByTestId('page-size-select'));
    await user.click(await screen.findByRole('option', { name: '50' }));

    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('hides the pagination footer when there are no broadcasts yet', () => {
    renderHistory({ notifications: [], totalCount: 0 });

    expect(screen.queryByTestId('next-page-btn')).not.toBeInTheDocument();
    expect(screen.getByText('No broadcasts sent yet.')).toBeInTheDocument();
  });
});
