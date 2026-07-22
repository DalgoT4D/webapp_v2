/**
 * BulkShareDialog: covers the add-person/group, set-general (with the
 * aggregated narrow-confirm step), and toggle-public-link actions, plus the
 * plain-language skip-reason mapping.
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkShareDialog } from '../bulk-share-dialog';
import { bulkApplyAccess } from '@/hooks/api/useResourceAccess';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useUserGroups } from '@/hooks/api/useUserGroups';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';

jest.mock('@/hooks/api/useResourceAccess', () => ({
  ...jest.requireActual('@/hooks/api/useResourceAccess'),
  bulkApplyAccess: jest.fn(),
}));
jest.mock('@/hooks/api/useUserManagement');
jest.mock('@/hooks/api/useUserGroups');
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastError: { api: jest.fn() },
  toastInfo: { generic: jest.fn() },
}));

const mockBulkApplyAccess = bulkApplyAccess as jest.Mock;
const mockUseUsers = useUsers as jest.Mock;
const mockUseUserGroups = useUserGroups as jest.Mock;

const items = [
  { rtype: 'dashboard' as const, id: '1' },
  { rtype: 'dashboard' as const, id: '2' },
];

function setup(overrides: Partial<React.ComponentProps<typeof BulkShareDialog>> = {}) {
  mockUseUsers.mockReturnValue({
    users: [{ orguser_id: 9, email: 'meera@ngo.org' }],
    isLoading: false,
  });
  mockUseUserGroups.mockReturnValue({ data: [{ id: 5, name: 'Field Team' }], isLoading: false });

  const onApplied = jest.fn();
  const onClose = jest.fn();

  render(
    <BulkShareDialog
      entityType="dashboard"
      entityLabel="dashboards"
      items={items}
      isOpen
      onClose={onClose}
      onApplied={onApplied}
      allowPublicLink
      {...overrides}
    />
  );

  return { onApplied, onClose };
}

describe('BulkShareDialog — add person/group', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends one POST with both items and the add_grant payload, toasts the summary, and calls onApplied', async () => {
    const user = userEvent.setup();
    mockBulkApplyAccess.mockResolvedValue({
      applied: items,
      skipped: [],
      requires_confirmation: [],
      applied_count: 2,
      skipped_count: 0,
    });
    const { onApplied } = setup();

    await user.click(screen.getByTestId('bulk-share-person-combobox-input'));
    await user.click(await screen.findByTestId('bulk-share-person-combobox-item-9'));
    await user.click(screen.getByTestId('bulk-share-add-person-btn'));

    await waitFor(() => {
      expect(mockBulkApplyAccess).toHaveBeenCalledWith({
        items,
        action: 'add_grant',
        add_grant: { principal_type: 'user', principal_id: 9, permission: 'view' },
      });
    });

    expect(onApplied).toHaveBeenCalledWith(
      expect.objectContaining({ applied_count: 2, skipped_count: 0 })
    );
    expect(toastSuccess.generic).toHaveBeenCalledWith(expect.stringMatching(/Shared 2 of 2/));
    expect(trackEvent).toHaveBeenCalledWith(
      'sharing:bulk_applied',
      expect.objectContaining({
        entity_type: 'dashboard',
        action: 'add_grant',
        selected_count: 2,
        applied_count: 2,
        skipped_count: 0,
      })
    );
  });

  it('renders skip reasons in plain language when items are skipped', async () => {
    const user = userEvent.setup();
    mockBulkApplyAccess.mockResolvedValue({
      applied: [items[0]],
      skipped: [{ rtype: 'dashboard', id: '2', reason: 'edit_access_denied' }],
      requires_confirmation: [],
      applied_count: 1,
      skipped_count: 1,
    });
    setup();

    await user.click(screen.getByTestId('bulk-share-person-combobox-input'));
    await user.click(await screen.findByTestId('bulk-share-person-combobox-item-9'));
    await user.click(screen.getByTestId('bulk-share-add-person-btn'));

    const reasons = await screen.findByTestId('bulk-share-skip-reasons');
    expect(within(reasons).getByText(/You can't edit this one/)).toBeInTheDocument();
    expect(toastInfo.generic).toHaveBeenCalledWith(
      expect.stringMatching(/Shared 1 of 2.*1 skipped/)
    );
  });
});

describe('BulkShareDialog — general access + narrow confirmation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defaults both role dropdowns to "No access" and sends analyst_level/member_level', async () => {
    const user = userEvent.setup();
    mockBulkApplyAccess.mockResolvedValue({
      applied: items,
      skipped: [],
      requires_confirmation: [],
      applied_count: 2,
      skipped_count: 0,
    });
    setup();

    expect(screen.getByTestId('bulk-share-general-analyst-level')).toHaveTextContent('No access');
    expect(screen.getByTestId('bulk-share-general-member-level')).toHaveTextContent('No access');

    await user.click(screen.getByTestId('bulk-share-general-apply-btn'));

    await waitFor(() => {
      expect(mockBulkApplyAccess).toHaveBeenCalledWith({
        items,
        action: 'set_general',
        set_general: { analyst_level: 'none', member_level: 'none' },
      });
    });
  });

  it('sends the chosen per-role levels independently', async () => {
    const user = userEvent.setup();
    mockBulkApplyAccess.mockResolvedValue({
      applied: items,
      skipped: [],
      requires_confirmation: [],
      applied_count: 2,
      skipped_count: 0,
    });
    setup();

    await user.click(screen.getByTestId('bulk-share-general-analyst-level'));
    await user.click(await screen.findByRole('option', { name: 'Can Edit' }));
    await user.click(screen.getByTestId('bulk-share-general-member-level'));
    await user.click(await screen.findByRole('option', { name: 'Can View' }));

    await user.click(screen.getByTestId('bulk-share-general-apply-btn'));

    await waitFor(() => {
      expect(mockBulkApplyAccess).toHaveBeenCalledWith({
        items,
        action: 'set_general',
        set_general: { analyst_level: 'edit', member_level: 'view' },
      });
    });
  });

  it('shows the aggregated confirm step, "keep" re-sends remove_grant_ids: [], "remove" re-sends the persisting grant ids', async () => {
    const user = userEvent.setup();
    mockBulkApplyAccess.mockResolvedValueOnce({
      applied: [items[0]],
      skipped: [],
      requires_confirmation: [
        {
          rtype: 'dashboard',
          id: '2',
          persisting_grants: [
            {
              id: 7,
              principal_type: 'user',
              principal_id: 9,
              email: 'meera@ngo.org',
              name: 'Meera Das',
              permission: 'view',
              status: 'active',
            },
          ],
        },
      ],
      applied_count: 1,
      skipped_count: 0,
    });
    setup();

    await user.click(screen.getByTestId('bulk-share-general-apply-btn'));

    const confirmPanel = await screen.findByTestId('bulk-share-confirm-panel');
    expect(within(confirmPanel).getByText(/Meera Das/)).toBeInTheDocument();

    mockBulkApplyAccess.mockResolvedValueOnce({
      applied: [items[1]],
      skipped: [],
      requires_confirmation: [],
      applied_count: 1,
      skipped_count: 0,
    });
    await user.click(screen.getByTestId('bulk-share-confirm-keep-btn'));

    await waitFor(() => {
      expect(mockBulkApplyAccess).toHaveBeenLastCalledWith({
        items,
        action: 'set_general',
        set_general: { analyst_level: 'none', member_level: 'none', remove_grant_ids: [] },
      });
    });
  });

  it('"remove their access too" re-sends the persisting grant ids', async () => {
    const user = userEvent.setup();
    mockBulkApplyAccess.mockResolvedValueOnce({
      applied: [],
      skipped: [],
      requires_confirmation: [
        { rtype: 'dashboard', id: '2', persisting_grants: [{ id: 7 } as any] },
      ],
      applied_count: 0,
      skipped_count: 0,
    });
    setup();

    await user.click(screen.getByTestId('bulk-share-general-apply-btn'));
    await screen.findByTestId('bulk-share-confirm-panel');

    mockBulkApplyAccess.mockResolvedValueOnce({
      applied: items,
      skipped: [],
      requires_confirmation: [],
      applied_count: 2,
      skipped_count: 0,
    });
    await user.click(screen.getByTestId('bulk-share-confirm-remove-btn'));

    await waitFor(() => {
      expect(mockBulkApplyAccess).toHaveBeenLastCalledWith({
        items,
        action: 'set_general',
        set_general: { analyst_level: 'none', member_level: 'none', remove_grant_ids: [7] },
      });
    });
  });
});

describe('BulkShareDialog — items snapshot (finding 2)', () => {
  beforeEach(() => jest.clearAllMocks());

  it("targets the items captured at open time for a second action, even after the items prop shrinks (parent deselected the first action's applied ids)", async () => {
    const user = userEvent.setup();
    mockBulkApplyAccess.mockResolvedValueOnce({
      applied: [items[0]],
      skipped: [],
      requires_confirmation: [],
      applied_count: 1,
      skipped_count: 0,
    });
    const onApplied = jest.fn();
    const onClose = jest.fn();
    const { rerender } = render(
      <BulkShareDialog
        entityType="dashboard"
        entityLabel="dashboards"
        items={items}
        isOpen
        onClose={onClose}
        onApplied={onApplied}
        allowPublicLink
      />
    );

    await user.click(screen.getByTestId('bulk-share-person-combobox-input'));
    await user.click(await screen.findByTestId('bulk-share-person-combobox-item-9'));
    await user.click(screen.getByTestId('bulk-share-add-person-btn'));
    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));

    // Simulate the parent: onApplied deselected item[0], shrinking the
    // `items` prop it hands back down on the next render.
    rerender(
      <BulkShareDialog
        entityType="dashboard"
        entityLabel="dashboards"
        items={[items[1]]}
        isOpen
        onClose={onClose}
        onApplied={onApplied}
        allowPublicLink
      />
    );

    mockBulkApplyAccess.mockResolvedValueOnce({
      applied: items,
      skipped: [],
      requires_confirmation: [],
      applied_count: 2,
      skipped_count: 0,
    });
    await user.click(screen.getByTestId('bulk-share-general-apply-btn'));

    await waitFor(() => {
      expect(mockBulkApplyAccess).toHaveBeenLastCalledWith({
        items, // the ORIGINAL two-item snapshot, not the shrunk one-item prop
        action: 'set_general',
        set_general: { analyst_level: 'none', member_level: 'none' },
      });
    });
  });

  it('still targets the full snapshot for a second action after everything applied and the items prop became empty, and the title stays accurate', async () => {
    const user = userEvent.setup();
    mockBulkApplyAccess.mockResolvedValueOnce({
      applied: items,
      skipped: [],
      requires_confirmation: [],
      applied_count: 2,
      skipped_count: 0,
    });
    const onApplied = jest.fn();
    const onClose = jest.fn();
    const { rerender } = render(
      <BulkShareDialog
        entityType="dashboard"
        entityLabel="dashboards"
        items={items}
        isOpen
        onClose={onClose}
        onApplied={onApplied}
        allowPublicLink
      />
    );

    expect(screen.getByText('Share 2 dashboards')).toBeInTheDocument();

    await user.click(screen.getByTestId('bulk-share-public-on-btn'));
    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));

    // Parent deselected both applied ids — items prop is now empty.
    rerender(
      <BulkShareDialog
        entityType="dashboard"
        entityLabel="dashboards"
        items={[]}
        isOpen
        onClose={onClose}
        onApplied={onApplied}
        allowPublicLink
      />
    );

    // The dialog keeps showing the snapshot's count, not the live (now empty) prop.
    expect(screen.getByText('Share 2 dashboards')).toBeInTheDocument();

    mockBulkApplyAccess.mockResolvedValueOnce({
      applied: items,
      skipped: [],
      requires_confirmation: [],
      applied_count: 2,
      skipped_count: 0,
    });
    await user.click(screen.getByTestId('bulk-share-public-off-btn'));

    await waitFor(() => {
      // A second POST never fires with an empty `items` array (the backend
      // 400s on that) — it must still be the two-item snapshot.
      expect(mockBulkApplyAccess).toHaveBeenLastCalledWith({
        items,
        action: 'toggle_public',
        toggle_public: { is_public: false },
      });
    });
  });

  it('disables every action button once the snapshot the dialog opened with is empty', () => {
    setup({ items: [] });
    expect(screen.getByTestId('bulk-share-add-person-btn')).toBeDisabled();
    expect(screen.getByTestId('bulk-share-add-group-btn')).toBeDisabled();
    expect(screen.getByTestId('bulk-share-general-apply-btn')).toBeDisabled();
    expect(screen.getByTestId('bulk-share-public-on-btn')).toBeDisabled();
    expect(screen.getByTestId('bulk-share-public-off-btn')).toBeDisabled();
  });

  it('keeps the add-person button disabled with an empty snapshot even after a person is selected', async () => {
    const user = userEvent.setup();
    setup({ items: [] });

    await user.click(screen.getByTestId('bulk-share-person-combobox-input'));
    await user.click(await screen.findByTestId('bulk-share-person-combobox-item-9'));

    expect(screen.getByTestId('bulk-share-add-person-btn')).toBeDisabled();
  });
});

describe('BulkShareDialog — public link', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers turn-on/turn-off actions for dashboards/reports', () => {
    setup({ allowPublicLink: true });
    expect(screen.getByTestId('bulk-share-public-on-btn')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-share-public-off-btn')).toBeInTheDocument();
  });

  it('shows no public-link action for alerts', () => {
    setup({ allowPublicLink: false, entityType: 'alert', entityLabel: 'alerts' });
    expect(screen.queryByTestId('bulk-share-public-on-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bulk-share-public-off-btn')).not.toBeInTheDocument();
  });

  it('turning the public link on sends toggle_public: { is_public: true }', async () => {
    const user = userEvent.setup();
    mockBulkApplyAccess.mockResolvedValue({
      applied: items,
      skipped: [],
      requires_confirmation: [],
      applied_count: 2,
      skipped_count: 0,
    });
    setup();

    await user.click(screen.getByTestId('bulk-share-public-on-btn'));

    await waitFor(() => {
      expect(mockBulkApplyAccess).toHaveBeenCalledWith({
        items,
        action: 'toggle_public',
        toggle_public: { is_public: true },
      });
    });
  });
});
