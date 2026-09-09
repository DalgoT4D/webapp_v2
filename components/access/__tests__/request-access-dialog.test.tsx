import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequestAccessDialog } from '@/components/access/request-access-dialog';
import * as accessHooks from '@/hooks/api/useAccess';

jest.mock('@/hooks/api/useAccess', () => ({
  createAccessRequest: jest.fn(),
}));

const mockCreateAccessRequest = accessHooks.createAccessRequest as jest.MockedFunction<
  typeof accessHooks.createAccessRequest
>;

describe('RequestAccessDialog', () => {
  beforeEach(() => mockCreateAccessRequest.mockReset());

  it('pre-selects the level from defaultLevel', () => {
    render(
      <RequestAccessDialog
        rtype="dashboard"
        resourceId={1}
        defaultLevel="edit"
        isOpen
        onClose={jest.fn()}
      />
    );
    expect(screen.getByRole('combobox')).toHaveTextContent(/edit/i);
  });

  it('disables the level select when lockLevel is set', () => {
    render(
      <RequestAccessDialog
        rtype="dashboard"
        resourceId={1}
        defaultLevel="edit"
        lockLevel
        isOpen
        onClose={jest.fn()}
      />
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('lets the user pick a level when unlocked (NoAccess flow)', () => {
    render(
      <RequestAccessDialog
        rtype="dashboard"
        resourceId={1}
        defaultLevel="view"
        isOpen
        onClose={jest.fn()}
      />
    );
    // Not locked → the trigger is enabled.
    expect(screen.getByRole('combobox')).not.toBeDisabled();
  });

  it('submits the requested level + note and fires the callbacks', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onSubmitted = jest.fn();
    mockCreateAccessRequest.mockResolvedValue({ id: 1, status: 'pending' } as any);

    render(
      <RequestAccessDialog
        rtype="chart"
        resourceId={99}
        defaultLevel="view"
        isOpen
        onClose={onClose}
        onSubmitted={onSubmitted}
      />
    );

    await user.type(screen.getByLabelText(/note/i), 'quarterly review');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(mockCreateAccessRequest).toHaveBeenCalledWith('chart', 99, {
      requested_level: 'view',
      note: 'quarterly review',
    });
    expect(onSubmitted).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
