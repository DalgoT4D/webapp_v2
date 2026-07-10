import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GroupFormDialog } from '../GroupFormDialog';
import { createGroup, renameGroup } from '@/hooks/api/useUserGroups';
import { trackEvent } from '@/lib/analytics';
import { createMockGroup } from './groups-mock-data';

jest.mock('@/hooks/api/useUserGroups', () => ({
  ...jest.requireActual('@/hooks/api/useUserGroups'),
  createGroup: jest.fn(),
  renameGroup: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('@/lib/toast', () => ({ toastSuccess: { generic: jest.fn() } }));

const mockCreateGroup = createGroup as jest.Mock;
const mockRenameGroup = renameGroup as jest.Mock;

describe('GroupFormDialog — create mode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a group and fires analytics on success', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();
    mockCreateGroup.mockResolvedValue(createMockGroup({ name: 'Funders' }));

    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={onSuccess} />);

    await user.type(screen.getByTestId('group-form-name-input'), 'Funders');
    await user.click(screen.getByTestId('group-form-submit-btn'));

    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledWith({ name: 'Funders' });
      expect(onSuccess).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('settings:group_created');
    });
  });

  it('shows the backend collision message inline, not as a generic toast', async () => {
    const user = userEvent.setup();
    mockCreateGroup.mockRejectedValue(
      new Error("a group named 'Funders' already exists in this org")
    );

    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);

    await user.type(screen.getByTestId('group-form-name-input'), 'Funders');
    await user.click(screen.getByTestId('group-form-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('group-form-error')).toHaveTextContent(
        "a group named 'Funders' already exists in this org"
      );
    });
  });

  it('disables submit when the name is blank', () => {
    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByTestId('group-form-submit-btn')).toBeDisabled();
  });
});

describe('GroupFormDialog — rename mode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('pre-fills the current name and renames on submit', async () => {
    const user = userEvent.setup();
    const onSuccess = jest.fn();
    const group = createMockGroup({ id: 7, name: 'Funders' });
    mockRenameGroup.mockResolvedValue({ ...group, name: 'Major Funders' });

    render(<GroupFormDialog open onOpenChange={jest.fn()} onSuccess={onSuccess} group={group} />);

    const input = screen.getByTestId('group-form-name-input') as HTMLInputElement;
    expect(input.value).toBe('Funders');

    await user.clear(input);
    await user.type(input, 'Major Funders');
    await user.click(screen.getByTestId('group-form-submit-btn'));

    await waitFor(() => {
      expect(mockRenameGroup).toHaveBeenCalledWith(7, { name: 'Major Funders' });
      expect(onSuccess).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('settings:group_renamed');
    });
  });
});
