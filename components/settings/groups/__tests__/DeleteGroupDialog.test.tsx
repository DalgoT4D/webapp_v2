import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteGroupDialog } from '../DeleteGroupDialog';
import { deleteGroup } from '@/hooks/api/useUserGroups';
import { trackEvent } from '@/lib/analytics';
import { createMockGroup } from './groups-mock-data';

jest.mock('@/hooks/api/useUserGroups', () => ({
  ...jest.requireActual('@/hooks/api/useUserGroups'),
  deleteGroup: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastError: { delete: jest.fn() },
}));

const mockDeleteGroup = deleteGroup as jest.Mock;

describe('DeleteGroupDialog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('warns that deleting the group removes the access it granted', () => {
    render(
      <DeleteGroupDialog
        open
        onOpenChange={jest.fn()}
        group={createMockGroup()}
        onSuccess={jest.fn()}
      />
    );
    expect(screen.getByTestId('delete-group-dialog')).toHaveTextContent(/removes any access/i);
  });

  it('deletes the group and fires analytics on confirm', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();
    mockDeleteGroup.mockResolvedValue(undefined);
    const group = createMockGroup({ id: 4 });

    render(<DeleteGroupDialog open onOpenChange={jest.fn()} group={group} onSuccess={onSuccess} />);
    await user.click(screen.getByTestId('delete-group-confirm-btn'));

    await waitFor(() => {
      expect(mockDeleteGroup).toHaveBeenCalledWith(4);
      expect(onSuccess).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('settings:group_deleted');
    });
  });
});
