// components/transform/canvas/__tests__/modals.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DiscardChangesDialog from '../modals/DiscardChangesDialog';
import PatRequiredModal from '../modals/PatRequiredModal';
import PublishModal from '../modals/PublishModal';
import { createMockGitStatusWithChanges } from './canvas-mock-data';

// Mock API
const mockApiGet = jest.fn();
const mockApiPost = jest.fn();
const mockApiPut = jest.fn();

jest.mock('@/lib/api', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  apiPut: (...args: unknown[]) => mockApiPut(...args),
}));

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('DiscardChangesDialog', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when open', () => {
    render(<DiscardChangesDialog {...defaultProps} />);

    expect(screen.getByText('Discard Changes?')).toBeInTheDocument();
    expect(screen.getByText(/all your changes will be discarded/i)).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    render(<DiscardChangesDialog {...defaultProps} />);

    const cancelBtn = screen.getByTestId('cancel-discard-btn');
    await userEvent.click(cancelBtn);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onConfirm when Confirm is clicked', async () => {
    render(<DiscardChangesDialog {...defaultProps} />);

    const confirmBtn = screen.getByTestId('confirm-discard-btn');
    await userEvent.click(confirmBtn);

    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('does not render when closed', () => {
    render(<DiscardChangesDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Discard Changes?')).not.toBeInTheDocument();
  });
});

describe('PatRequiredModal', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onAddKey: jest.fn(),
    onViewOnly: jest.fn(),
    gitRepoUrl: 'https://github.com/org/repo.git',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when open', () => {
    render(<PatRequiredModal {...defaultProps} />);

    expect(screen.getByText('Git Authentication Required')).toBeInTheDocument();
    expect(screen.getByTestId('git-repo-url-input')).toHaveValue('https://github.com/org/repo.git');
  });

  it('shows validation error when submitting without PAT', async () => {
    render(<PatRequiredModal {...defaultProps} />);

    const connectBtn = screen.getByTestId('connect-btn');
    await userEvent.click(connectBtn);

    expect(screen.getByText('Personal Access Token is required')).toBeInTheDocument();
  });

  it('calls API and callbacks on successful submit', async () => {
    mockApiPut.mockResolvedValue({ success: true });

    render(<PatRequiredModal {...defaultProps} />);

    const patInput = screen.getByTestId('pat-input');
    await userEvent.type(patInput, 'ghp_test_token_12345');

    const connectBtn = screen.getByTestId('connect-btn');
    await userEvent.click(connectBtn);

    await waitFor(() => {
      expect(mockApiPut).toHaveBeenCalledWith('/api/dbt/connect_git_remote/', {
        gitrepoUrl: 'https://github.com/org/repo.git',
        gitrepoAccessToken: 'ghp_test_token_12345',
      });
    });

    await waitFor(() => {
      expect(defaultProps.onAddKey).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('calls onViewOnly when "Proceed without token" is clicked', async () => {
    render(<PatRequiredModal {...defaultProps} />);

    const viewOnlyBtn = screen.getByTestId('view-only-btn');
    await userEvent.click(viewOnlyBtn);

    expect(defaultProps.onViewOnly).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows external link to GitHub', () => {
    render(<PatRequiredModal {...defaultProps} />);

    const githubLink = screen.getByText('Create one on GitHub');
    expect(githubLink).toHaveAttribute('href', 'https://github.com/settings/tokens');
    expect(githubLink).toHaveAttribute('target', '_blank');
  });
});

describe('PublishModal', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onPublishSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGet.mockResolvedValue(createMockGitStatusWithChanges());
  });

  it('renders and fetches git status when opened', async () => {
    render(<PublishModal {...defaultProps} />);

    // Use getByRole to get the dialog title specifically
    expect(screen.getByRole('heading', { name: 'Publish Changes' })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/dbt/git_status/');
    });

    await waitFor(() => {
      expect(screen.getByText('Added (2)')).toBeInTheDocument();
      expect(screen.getByText('Modified (1)')).toBeInTheDocument();
      expect(screen.getByText('Deleted (1)')).toBeInTheDocument();
    });
  });

  it('displays file changes with correct indicators', async () => {
    render(<PublishModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('added-file-models/staging/stg_orders.sql')).toHaveTextContent(
        '+ models/staging/stg_orders.sql'
      );
      expect(screen.getByTestId('modified-file-models/marts/dim_products.sql')).toHaveTextContent(
        '~ models/marts/dim_products.sql'
      );
      expect(screen.getByTestId('deleted-file-models/staging/old_model.sql')).toHaveTextContent(
        '- models/staging/old_model.sql'
      );
    });
  });

  it('disables publish button when commit message is empty', async () => {
    render(<PublishModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Added (2)')).toBeInTheDocument();
    });

    const publishBtn = screen.getByTestId('publish-btn');
    expect(publishBtn).toBeDisabled();
  });

  it('enables publish button when commit message is entered', async () => {
    render(<PublishModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Added (2)')).toBeInTheDocument();
    });

    const commitInput = screen.getByTestId('commit-message-input');
    await userEvent.type(commitInput, 'Add new staging models');

    const publishBtn = screen.getByTestId('publish-btn');
    expect(publishBtn).not.toBeDisabled();
  });

  it('calls API and callbacks on successful publish', async () => {
    mockApiPost.mockResolvedValue({ success: true });

    render(<PublishModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Added (2)')).toBeInTheDocument();
    });

    const commitInput = screen.getByTestId('commit-message-input');
    await userEvent.type(commitInput, 'Add new staging models');

    const publishBtn = screen.getByTestId('publish-btn');
    await userEvent.click(publishBtn);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/dbt/publish_changes/', {
        commit_message: 'Add new staging models',
      });
    });

    await waitFor(() => {
      expect(defaultProps.onPublishSuccess).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('shows "No changes" when git status is empty', async () => {
    mockApiGet.mockResolvedValue({ added: [], modified: [], deleted: [] });

    render(<PublishModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('no-changes-message')).toBeInTheDocument();
    });

    // Publish button should be disabled
    const publishBtn = screen.getByTestId('publish-btn');
    expect(publishBtn).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    render(<PublishModal {...defaultProps} />);

    const cancelBtn = screen.getByTestId('cancel-btn');
    await userEvent.click(cancelBtn);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
