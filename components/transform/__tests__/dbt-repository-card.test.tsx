/**
 * DBTRepositoryCard Tests
 *
 * Tests for the DBT repository connection card component.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DBTRepositoryCard } from '../DBTRepositoryCard';
import * as useDbtWorkspaceHook from '@/hooks/api/useDbtWorkspace';
import * as usePermissionsHook from '@/hooks/api/usePermissions';

// ============ Mocks ============

jest.mock('@/hooks/api/useDbtWorkspace');
jest.mock('@/hooks/api/usePermissions');

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn(), updated: jest.fn() },
  toastError: { save: jest.fn() },
  toastInfo: { noChanges: jest.fn() },
}));

// ============ DBTRepositoryCard Tests ============

describe('DBTRepositoryCard', () => {
  const mockOnConnectGit = jest.fn();
  const mockMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useDbtWorkspaceHook.useDbtWorkspace as jest.Mock).mockReturnValue({
      data: null,
      mutate: mockMutate,
    });

    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (perm: string) => {
        return ['can_create_dbt_workspace', 'can_edit_dbt_workspace'].includes(perm);
      },
    });

    jest.spyOn(useDbtWorkspaceHook, 'switchGitRepo').mockResolvedValue(undefined);
    jest.spyOn(useDbtWorkspaceHook, 'updateSchema').mockResolvedValue(undefined);
  });

  it('shows unconnected state with Connect button when no workspace', () => {
    render(<DBTRepositoryCard onConnectGit={mockOnConnectGit} />);

    expect(screen.getByText('Connect your DBT project Git repository')).toBeInTheDocument();
    expect(screen.getByTestId('connect-git-btn')).toHaveTextContent('CONNECT TO GITHUB');
  });

  it('disables connect button when user lacks can_create_dbt_workspace permission', () => {
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: () => false,
    });

    render(<DBTRepositoryCard onConnectGit={mockOnConnectGit} />);

    expect(screen.getByTestId('connect-git-btn')).toBeDisabled();
  });

  it('shows connected state with repo URL and EDIT button', () => {
    (useDbtWorkspaceHook.useDbtWorkspace as jest.Mock).mockReturnValue({
      data: { gitrepo_url: 'https://github.com/org/repo', default_schema: 'intermediate' },
      mutate: mockMutate,
    });

    render(<DBTRepositoryCard onConnectGit={mockOnConnectGit} />);

    expect(screen.getByTestId('connect-git-btn')).toHaveTextContent('EDIT');
    expect(screen.getByText('https://github.com/org/repo')).toBeInTheDocument();
    expect(screen.getByText('intermediate')).toBeInTheDocument();
  });

  it('opens dialog and shows form fields when Connect button is clicked', async () => {
    const user = userEvent.setup();
    render(<DBTRepositoryCard onConnectGit={mockOnConnectGit} />);

    await user.click(screen.getByTestId('connect-git-btn'));

    expect(screen.getByTestId('git-url-input')).toBeInTheDocument();
    expect(screen.getByTestId('git-token-input')).toBeInTheDocument();
    expect(screen.getByTestId('default-schema-input')).toBeInTheDocument();
    expect(screen.getByTestId('save-git-btn')).toBeInTheDocument();
  });

  it('shows URL validation error when invalid URL is submitted', async () => {
    const user = userEvent.setup();
    render(<DBTRepositoryCard onConnectGit={mockOnConnectGit} />);

    await user.click(screen.getByTestId('connect-git-btn'));
    await user.type(screen.getByTestId('git-url-input'), 'not-a-valid-url');
    await user.click(screen.getByTestId('save-git-btn'));

    await waitFor(() => {
      expect(screen.getByText(/Must be a valid GitHub repository URL/i)).toBeInTheDocument();
    });
  });

  it('calls switchGitRepo and onConnectGit on successful connect submit', async () => {
    const user = userEvent.setup();
    const mockSwitch = jest
      .spyOn(useDbtWorkspaceHook, 'switchGitRepo')
      .mockResolvedValue(undefined);

    render(<DBTRepositoryCard onConnectGit={mockOnConnectGit} />);

    await user.click(screen.getByTestId('connect-git-btn'));
    await user.type(screen.getByTestId('git-url-input'), 'https://github.com/org/my-repo');
    await user.type(screen.getByTestId('git-token-input'), 'ghp_mytoken123');
    await user.click(screen.getByTestId('save-git-btn'));

    await waitFor(() => {
      expect(mockSwitch).toHaveBeenCalledWith('https://github.com/org/my-repo', 'ghp_mytoken123');
      expect(mockOnConnectGit).toHaveBeenCalledTimes(1);
    });
  });
});
