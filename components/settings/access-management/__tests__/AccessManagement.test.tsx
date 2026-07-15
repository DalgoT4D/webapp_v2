/**
 * Settings > Access > Roles tab: "Default permissions" table
 * (permission-model rework, D1). Replaces the old org-wide
 * audience+level picker pair with a 3-row Role | Data & Pipeline access |
 * Resources access table — Admins fixed/locked, Analysts and Members each
 * an independently settable No access / Can View / Can Edit dropdown — plus
 * page-level SAVE/CANCEL draft semantics for the table. The public-sharing
 * kill switch keeps its pre-existing immediate-apply behavior (deliberate
 * deviation — it has side effects on live public links).
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccessManagement from '../AccessManagement';
import { useOrgPreferences, updateSharingPreferences } from '@/hooks/api/useNotifications';
import { trackEvent } from '@/lib/analytics';

jest.mock('@/hooks/api/useNotifications', () => ({
  ...jest.requireActual('@/hooks/api/useNotifications'),
  useOrgPreferences: jest.fn(),
  updateSharingPreferences: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastError: { api: jest.fn() },
}));

const mockUseOrgPreferences = useOrgPreferences as jest.Mock;
const mockUpdateSharingPreferences = updateSharingPreferences as jest.Mock;

const baseOrgPreferences = {
  enable_discord_notifications: false,
  discord_webhook: '',
  allow_public_sharing: true,
  default_analyst_level: 'edit' as const,
  default_member_level: 'view' as const,
};

function setup(overrides: Partial<typeof baseOrgPreferences> = {}) {
  const mutate = jest.fn();
  mockUseOrgPreferences.mockReturnValue({
    orgPreferences: { ...baseOrgPreferences, ...overrides },
    isLoading: false,
    error: undefined,
    mutate,
  });
  return { mutate };
}

describe('AccessManagement — Default permissions table', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders three role rows with descriptions and the right chips/locks', () => {
    setup();
    render(<AccessManagement />);

    const adminRow = screen.getByTestId('access-mgmt-role-row-admin');
    expect(adminRow).toHaveTextContent('Admins');
    expect(adminRow).toHaveTextContent('Run the organisation, manage people, settings and data.');

    const analystRow = screen.getByTestId('access-mgmt-role-row-analyst');
    expect(analystRow).toHaveTextContent('Analysts');
    expect(analystRow).toHaveTextContent('Build and maintain dashboards, charts and reports.');

    const memberRow = screen.getByTestId('access-mgmt-role-row-member');
    expect(memberRow).toHaveTextContent('Members');
    expect(memberRow).toHaveTextContent('Work with the shared dashboards and reports');

    // Data & Pipeline access — informational, disabled chips, never wired up.
    expect(screen.getByTestId('access-mgmt-data-pipeline-admin')).toHaveTextContent('All access');
    expect(screen.getByTestId('access-mgmt-data-pipeline-analyst')).toHaveTextContent('View only');
    expect(screen.getByTestId('access-mgmt-data-pipeline-member')).toHaveTextContent('No access');

    // Resources access — Admins locked, Analysts/Members reflect GET data.
    const adminResources = screen.getByTestId('access-mgmt-resources-admin');
    expect(adminResources).toHaveTextContent('All access');
    expect(screen.getByTestId('access-mgmt-resources-admin-lock')).toBeInTheDocument();
    expect(screen.getByTestId('access-mgmt-resources-analyst')).toHaveTextContent('Can Edit');
    expect(screen.getByTestId('access-mgmt-resources-member')).toHaveTextContent('Can View');
  });

  it('offers No access / Can View / Can Edit in the Analyst and Member dropdowns', async () => {
    const user = userEvent.setup();
    setup();
    render(<AccessManagement />);

    await user.click(screen.getByTestId('access-mgmt-resources-analyst'));
    expect(screen.getByRole('option', { name: 'No access' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Can View' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Can Edit' })).toBeInTheDocument();
  });

  it('shows a skeleton loading state while preferences are being fetched', () => {
    mockUseOrgPreferences.mockReturnValue({
      orgPreferences: undefined,
      isLoading: true,
      error: undefined,
      mutate: jest.fn(),
    });
    render(<AccessManagement />);
    expect(screen.getByTestId('access-management-loading')).toBeInTheDocument();
    // A skeleton, not a spinner/text row — repo convention (components/ui/skeleton.tsx).
    expect(
      screen.getByTestId('access-management-loading').querySelector('[data-slot="skeleton"]')
    ).toBeInTheDocument();
  });

  it('SAVE and CANCEL are disabled until a dropdown is changed', async () => {
    const user = userEvent.setup();
    setup();
    render(<AccessManagement />);

    expect(screen.getByTestId('access-mgmt-save-btn')).toBeDisabled();
    expect(screen.getByTestId('access-mgmt-cancel-btn')).toBeDisabled();

    await user.click(screen.getByTestId('access-mgmt-resources-member'));
    await user.click(screen.getByRole('option', { name: 'Can Edit' }));

    expect(screen.getByTestId('access-mgmt-save-btn')).toBeEnabled();
    expect(screen.getByTestId('access-mgmt-cancel-btn')).toBeEnabled();
  });

  it('SAVE issues one PUT with both default levels and revalidates', async () => {
    const user = userEvent.setup();
    const { mutate } = setup();
    mockUpdateSharingPreferences.mockResolvedValue({
      ...baseOrgPreferences,
      default_member_level: 'edit',
    });
    render(<AccessManagement />);

    await user.click(screen.getByTestId('access-mgmt-resources-member'));
    await user.click(screen.getByRole('option', { name: 'Can Edit' }));
    await user.click(screen.getByTestId('access-mgmt-save-btn'));

    await waitFor(() => {
      expect(mockUpdateSharingPreferences).toHaveBeenCalledTimes(1);
      expect(mockUpdateSharingPreferences).toHaveBeenCalledWith({
        default_analyst_level: 'edit',
        default_member_level: 'edit',
      });
      expect(mutate).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith(
        'settings:sharing_settings_updated',
        expect.objectContaining({
          setting: 'default_permissions',
          analyst_level: 'edit',
          member_level: 'edit',
        })
      );
    });
  });

  it('CANCEL reverts the draft to the last-saved values without calling the API', async () => {
    const user = userEvent.setup();
    setup();
    render(<AccessManagement />);

    await user.click(screen.getByTestId('access-mgmt-resources-member'));
    await user.click(screen.getByRole('option', { name: 'Can Edit' }));
    expect(screen.getByTestId('access-mgmt-resources-member')).toHaveTextContent('Can Edit');

    await user.click(screen.getByTestId('access-mgmt-cancel-btn'));

    expect(screen.getByTestId('access-mgmt-resources-member')).toHaveTextContent('Can View');
    expect(mockUpdateSharingPreferences).not.toHaveBeenCalled();
    expect(screen.getByTestId('access-mgmt-save-btn')).toBeDisabled();
  });

  it('resyncs the draft when orgPreferences changes in the background and the draft is untouched', () => {
    setup({ default_analyst_level: 'edit', default_member_level: 'view' });
    const { rerender } = render(<AccessManagement />);
    expect(screen.getByTestId('access-mgmt-resources-member')).toHaveTextContent('Can View');

    // Simulate a background SWR revalidation bringing in a value changed
    // elsewhere (another admin, or a stale->fresh cache correction) while
    // this user hasn't touched a dropdown.
    setup({ default_analyst_level: 'edit', default_member_level: 'edit' });
    rerender(<AccessManagement />);

    expect(screen.getByTestId('access-mgmt-resources-member')).toHaveTextContent('Can Edit');
    expect(screen.getByTestId('access-mgmt-save-btn')).toBeDisabled();
  });

  it('does not clobber an in-progress unsaved edit when orgPreferences changes in the background', async () => {
    const user = userEvent.setup();
    setup({ default_analyst_level: 'edit', default_member_level: 'view' });
    const { rerender } = render(<AccessManagement />);

    await user.click(screen.getByTestId('access-mgmt-resources-member'));
    await user.click(screen.getByRole('option', { name: 'Can Edit' }));
    expect(screen.getByTestId('access-mgmt-resources-member')).toHaveTextContent('Can Edit');

    // Background revalidation lands mid-edit — must not overwrite the
    // user's unsaved draft change.
    setup({ default_analyst_level: 'none', default_member_level: 'view' });
    rerender(<AccessManagement />);

    expect(screen.getByTestId('access-mgmt-resources-member')).toHaveTextContent('Can Edit');
    expect(screen.getByTestId('access-mgmt-resources-analyst')).toHaveTextContent('Can Edit');
  });

  it('shows a toast error and does not crash when SAVE fails', async () => {
    const user = userEvent.setup();
    setup();
    mockUpdateSharingPreferences.mockRejectedValue(new Error('nope'));
    render(<AccessManagement />);

    await user.click(screen.getByTestId('access-mgmt-resources-member'));
    await user.click(screen.getByRole('option', { name: 'Can Edit' }));
    await user.click(screen.getByTestId('access-mgmt-save-btn'));

    const { toastError } = jest.requireMock('@/lib/toast');
    await waitFor(() => {
      expect(toastError.api).toHaveBeenCalled();
    });
  });

  it('keeps the public-sharing toggle on its existing immediate-apply behavior', async () => {
    const user = userEvent.setup();
    const { mutate } = setup({ allow_public_sharing: true });
    mockUpdateSharingPreferences.mockResolvedValue({
      ...baseOrgPreferences,
      allow_public_sharing: false,
    });

    render(<AccessManagement />);
    const toggle = screen.getByTestId('access-mgmt-public-sharing-toggle');
    expect(toggle).toHaveAttribute('data-state', 'checked');

    await user.click(toggle);

    await waitFor(() => {
      expect(mockUpdateSharingPreferences).toHaveBeenCalledWith({ allow_public_sharing: false });
      expect(mutate).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith(
        'settings:sharing_settings_updated',
        expect.objectContaining({ setting: 'allow_public_sharing', value: false })
      );
    });
    // Immediate-apply: no SAVE/CANCEL involvement for the kill switch.
    expect(screen.getByTestId('access-mgmt-save-btn')).toBeDisabled();
  });
});
