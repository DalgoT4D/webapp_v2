/**
 * AdminCreateOrganizationPage — an org is never created without an owner, so the
 * form requires an admin email alongside the name and sends it with the create call.
 * That person is invited as the org's Admin by the backend (the role is resolved
 * server-side and is deliberately not a field here).
 *
 * The email field copies the Users-tab invite dialog: type=email input, the shared
 * EMAIL_RE check, and an inline destructive-text error.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminCreateOrganizationPage from '@/app/admin/organizations/new/page';
import * as useAdminPortal from '@/hooks/api/useAdminPortal';

jest.mock('@/hooks/api/useAdminPortal');

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockCreateOrg = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAdminPortal.useAdminOrgActions as jest.Mock).mockReturnValue({
    createOrg: mockCreateOrg,
    updateOrg: jest.fn(),
    deleteOrg: jest.fn(),
  });
  mockCreateOrg.mockResolvedValue({ id: 42, name: 'Bhumi' });
});

describe('AdminCreateOrganizationPage admin email', () => {
  it('renders a required admin email field', () => {
    render(<AdminCreateOrganizationPage />);

    const input = screen.getByTestId('org-admin-email-input');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/admin email/i)).toBe(input);
  });

  it('does not offer a role choice — the first user is always Admin, set server-side', () => {
    render(<AdminCreateOrganizationPage />);

    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
  });

  it('blocks submit until both the name and the admin email are filled', async () => {
    const user = userEvent.setup({ delay: null });
    render(<AdminCreateOrganizationPage />);

    const submit = screen.getByTestId('create-org-submit');
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Name'), 'Bhumi');
    expect(submit).toBeDisabled(); // name alone is not enough any more

    await user.type(screen.getByTestId('org-admin-email-input'), 'owner@bhumi.org');
    expect(submit).not.toBeDisabled();
  });

  it('rejects a malformed admin email without calling the API', async () => {
    const user = userEvent.setup({ delay: null });
    render(<AdminCreateOrganizationPage />);

    await user.type(screen.getByLabelText('Name'), 'Bhumi');
    await user.type(screen.getByTestId('org-admin-email-input'), 'not-an-email');
    await user.click(screen.getByTestId('create-org-submit'));

    expect(await screen.findByText('Invalid email address')).toBeInTheDocument();
    expect(mockCreateOrg).not.toHaveBeenCalled();
  });

  it('sends admin_email with the create call and redirects to the new org', async () => {
    const user = userEvent.setup({ delay: null });
    render(<AdminCreateOrganizationPage />);

    await user.type(screen.getByLabelText('Name'), 'Bhumi');
    await user.type(screen.getByTestId('org-admin-email-input'), '  Owner@Bhumi.org  ');
    await user.click(screen.getByTestId('create-org-submit'));

    await waitFor(() =>
      expect(mockCreateOrg).toHaveBeenCalledWith({
        name: 'Bhumi',
        viz_url: undefined,
        base_plan: 'Free Trial',
        admin_email: 'Owner@Bhumi.org',
      })
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/admin/organizations/42'));
  });

  it('keeps the form filled when creation fails, so nothing is retyped', async () => {
    mockCreateOrg.mockRejectedValueOnce(new Error('airbyte is down'));
    const user = userEvent.setup({ delay: null });
    render(<AdminCreateOrganizationPage />);

    await user.type(screen.getByLabelText('Name'), 'Bhumi');
    await user.type(screen.getByTestId('org-admin-email-input'), 'owner@bhumi.org');
    await user.click(screen.getByTestId('create-org-submit'));

    await waitFor(() => expect(mockCreateOrg).toHaveBeenCalled());
    expect(screen.getByLabelText('Name')).toHaveValue('Bhumi');
    expect(screen.getByTestId('org-admin-email-input')).toHaveValue('owner@bhumi.org');
    expect(screen.getByTestId('create-org-submit')).not.toBeDisabled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('tells the admin what will happen to the person they name', () => {
    render(<AdminCreateOrganizationPage />);

    expect(
      screen.getByText(/invited as the organization.s Admin and set their own password/i)
    ).toBeInTheDocument();
  });
});
