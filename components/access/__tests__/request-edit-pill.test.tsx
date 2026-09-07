import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequestEditPill } from '@/components/access/request-edit-pill';
import * as accessHooks from '@/hooks/api/useAccess';

jest.mock('@/hooks/api/useAccess', () => ({
  createAccessRequest: jest.fn(),
}));

const mockCreateAccessRequest = accessHooks.createAccessRequest as jest.MockedFunction<
  typeof accessHooks.createAccessRequest
>;

describe('RequestEditPill — visibility', () => {
  it('renders when the caller has view access', () => {
    render(<RequestEditPill rtype="dashboard" resourceId={1} resourceAccessLevel="view" />);
    expect(screen.getByTestId('request-edit-pill')).toBeInTheDocument();
    expect(screen.getByTestId('request-edit-pill')).toHaveTextContent('Request Edit');
  });

  it('renders nothing when the caller has edit access', () => {
    const { container } = render(
      <RequestEditPill rtype="dashboard" resourceId={1} resourceAccessLevel="edit" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when access_level is undefined (owner/admin/no data yet)', () => {
    const { container } = render(
      <RequestEditPill rtype="dashboard" resourceId={1} resourceAccessLevel={undefined} />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('RequestEditPill — submit flow', () => {
  beforeEach(() => {
    mockCreateAccessRequest.mockReset();
  });

  it('opens the request dialog with Edit pre-selected (and locked)', async () => {
    const user = userEvent.setup();
    render(<RequestEditPill rtype="dashboard" resourceId={7} resourceAccessLevel="view" />);

    await user.click(screen.getByTestId('request-edit-pill'));

    // Dialog is open; the level Select trigger shows "Edit"
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent(/edit/i);
    // Locked — trigger is disabled so the user can't switch to View.
    expect(trigger).toBeDisabled();
  });

  it('POSTs the request at edit level and flips the pill to a sent state', async () => {
    const user = userEvent.setup();
    mockCreateAccessRequest.mockResolvedValue({ id: 1, status: 'pending' } as any);

    render(<RequestEditPill rtype="report" resourceId={42} resourceAccessLevel="view" />);

    await user.click(screen.getByTestId('request-edit-pill'));
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(mockCreateAccessRequest).toHaveBeenCalledWith(
      'report',
      42,
      expect.objectContaining({ requested_level: 'edit' })
    );
    expect(await screen.findByText(/request edit sent/i)).toBeInTheDocument();
  });
});
