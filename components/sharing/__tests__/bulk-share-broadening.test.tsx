/**
 * BulkShareDialog — v1.1 M3b dashboard-broadening confirmations: bulk
 * add_grant / toggle_public (enable) items held with their under-covering
 * charts come back in `requires_confirmation`; the dialog aggregates them
 * into ONE prompt (spec §1) and YES re-sends the SAME action to just the
 * held items with the confirm fields.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkShareDialog } from '../bulk-share-dialog';
import { bulkApplyAccess, type ChartCoverageVerdict } from '@/hooks/api/useResourceAccess';
import { useUsers } from '@/hooks/api/useUserManagement';
import { useUserGroups } from '@/hooks/api/useUserGroups';

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

const items = [
  { rtype: 'dashboard' as const, id: '1' },
  { rtype: 'dashboard' as const, id: '2' },
];

function setup() {
  mockUseUsers.mockReturnValue({
    users: [{ orguser_id: 9, email: 'meera@ngo.org' }],
    isLoading: false,
  });
  mockUseUserGroups.mockReturnValue({ data: [], isLoading: false });

  const onApplied = jest.fn();
  render(
    <BulkShareDialog
      entityType="dashboard"
      entityLabel="dashboards"
      items={items}
      isOpen
      onClose={jest.fn()}
      onApplied={onApplied}
      allowPublicLink
    />
  );
  return { onApplied };
}

async function addPerson(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('bulk-share-person-combobox-input'));
  await user.click(await screen.findByTestId('bulk-share-person-combobox-item-9'));
  await user.click(screen.getByTestId('bulk-share-add-person-btn'));
}

describe('BulkShareDialog — aggregated broadening prompt', () => {
  beforeEach(() => jest.clearAllMocks());

  it('add_grant: aggregates per-item confirmations into ONE prompt; YES re-sends held items with extend ids + proceed', async () => {
    const user = userEvent.setup();
    mockBulkApplyAccess
      .mockResolvedValueOnce({
        applied: [],
        skipped: [],
        requires_confirmation: [
          {
            rtype: 'dashboard',
            id: '1',
            persisting_grants: [],
            under_covering_charts: [
              verdict({
                chart_id: 7,
                title: 'Salary Breakdown',
                extendable: true,
                viewer_can_edit: true,
              }),
            ],
          },
          {
            rtype: 'dashboard',
            id: '2',
            persisting_grants: [],
            under_covering_charts: [
              verdict({
                chart_id: 8,
                title: 'Field Visits',
                extendable: true,
                viewer_can_edit: true,
              }),
            ],
          },
        ],
        applied_count: 0,
        skipped_count: 0,
      })
      .mockResolvedValueOnce({
        applied: items,
        skipped: [],
        requires_confirmation: [],
        applied_count: 2,
        skipped_count: 0,
      });
    setup();

    await addPerson(user);

    // ONE aggregated prompt naming both dashboards' charts.
    await waitFor(() =>
      expect(screen.getByTestId('broadening-confirm-dialog')).toBeInTheDocument()
    );
    const charts = screen.getByTestId('broadening-confirm-charts');
    expect(charts).toHaveTextContent('Salary Breakdown');
    expect(charts).toHaveTextContent('Field Visits');

    fireEvent.click(screen.getByTestId('broadening-confirm-yes'));

    await waitFor(() => expect(mockBulkApplyAccess).toHaveBeenCalledTimes(2));
    expect(mockBulkApplyAccess).toHaveBeenLastCalledWith({
      items,
      action: 'add_grant',
      add_grant: {
        principal_type: 'user',
        principal_id: 9,
        permission: 'view',
        extend_chart_ids: [7, 8],
        proceed: true,
      },
    });
    await waitFor(() =>
      expect(screen.queryByTestId('broadening-confirm-dialog')).not.toBeInTheDocument()
    );
  });

  it('add_grant: CANCEL drops the prompt without re-sending', async () => {
    const user = userEvent.setup();
    mockBulkApplyAccess.mockResolvedValueOnce({
      applied: [],
      skipped: [],
      requires_confirmation: [
        {
          rtype: 'dashboard',
          id: '1',
          persisting_grants: [],
          under_covering_charts: [verdict({ extendable: true, viewer_can_edit: true })],
        },
      ],
      applied_count: 0,
      skipped_count: 0,
    });
    setup();

    await addPerson(user);
    await waitFor(() =>
      expect(screen.getByTestId('broadening-confirm-dialog')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('broadening-confirm-cancel'));

    await waitFor(() =>
      expect(screen.queryByTestId('broadening-confirm-dialog')).not.toBeInTheDocument()
    );
    expect(mockBulkApplyAccess).toHaveBeenCalledTimes(1);
  });

  it('toggle_public enable: prompt is proceed-only (no extend field on the re-send)', async () => {
    const user = userEvent.setup();
    mockBulkApplyAccess
      .mockResolvedValueOnce({
        applied: [{ rtype: 'dashboard', id: '2' }],
        skipped: [],
        requires_confirmation: [
          {
            rtype: 'dashboard',
            id: '1',
            persisting_grants: [],
            under_covering_charts: [verdict({ public_exposure: true })],
          },
        ],
        applied_count: 1,
        skipped_count: 0,
      })
      .mockResolvedValueOnce({
        applied: [{ rtype: 'dashboard', id: '1' }],
        skipped: [],
        requires_confirmation: [],
        applied_count: 1,
        skipped_count: 0,
      });
    setup();

    await user.click(screen.getByTestId('bulk-share-public-on-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('broadening-confirm-dialog')).toBeInTheDocument()
    );
    // Public exposure is never extendable — the copy offers no extend-all.
    expect(screen.getByTestId('broadening-confirm-body')).not.toHaveTextContent('Extend all');

    fireEvent.click(screen.getByTestId('broadening-confirm-yes'));

    await waitFor(() => expect(mockBulkApplyAccess).toHaveBeenCalledTimes(2));
    expect(mockBulkApplyAccess).toHaveBeenLastCalledWith({
      items: [{ rtype: 'dashboard', id: '1' }],
      action: 'toggle_public',
      toggle_public: { is_public: true, proceed: true },
    });
  });
});
