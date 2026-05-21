/**
 * CanvasHeader Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CanvasHeader from '../CanvasHeader';
import * as usePermissionsHook from '@/hooks/api/usePermissions';
import { CanvasNodeTypeEnum } from '@/types/transform';

// ============ Mocks ============

jest.mock('@/hooks/api/usePermissions');

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const mockStoreState = {
  selectedNode: null as { data: { node_type: CanvasNodeTypeEnum } } | null,
  dispatchCanvasAction: jest.fn(),
  openPublishModal: jest.fn(),
  patRequired: false,
};

jest.mock('@/stores/transformStore', () => ({
  useTransformStore: (selector: (s: typeof mockStoreState) => unknown) => selector(mockStoreState),
}));

// ============ CanvasHeader Tests ============

describe('CanvasHeader', () => {
  const defaultProps = {
    isLocked: false,
    isWorkflowRunning: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState.selectedNode = null;
    mockStoreState.patRequired = false;

    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (perm: string) => perm === 'can_run_pipeline',
    });
  });

  it('hides Run and Publish buttons in preview mode', () => {
    render(<CanvasHeader {...defaultProps} isPreviewMode={true} />);

    expect(screen.queryByTestId('run-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('publish-button')).not.toBeInTheDocument();
    expect(screen.getByText('Workflow Preview')).toBeInTheDocument();
  });

  it('disables Run button when user lacks can_run_pipeline permission', () => {
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: () => false,
    });

    render(<CanvasHeader {...defaultProps} />);
    expect(screen.getByTestId('run-button')).toBeDisabled();
  });

  it('disables Run button when canvas is locked by another user', () => {
    render(<CanvasHeader {...defaultProps} isLocked={true} />);
    expect(screen.getByTestId('run-button')).toBeDisabled();
  });

  it('disables Publish button when PAT is not configured', () => {
    mockStoreState.patRequired = true;
    render(<CanvasHeader {...defaultProps} />);
    expect(screen.getByTestId('publish-button')).toBeDisabled();
  });

  it('shows git repo link only when gitRepoUrl is provided', () => {
    const { rerender } = render(<CanvasHeader {...defaultProps} />);
    expect(screen.queryByTestId('git-repo-link')).not.toBeInTheDocument();

    rerender(<CanvasHeader {...defaultProps} gitRepoUrl="https://github.com/org/repo" />);
    expect(screen.getByTestId('git-repo-link')).toBeInTheDocument();
  });

  it('disables run-to-node and run-from-node when no node is selected', async () => {
    const user = userEvent.setup();
    render(<CanvasHeader {...defaultProps} />);

    await user.click(screen.getByTestId('run-button'));

    expect(screen.getByTestId('run-to-node-option')).toHaveAttribute('data-disabled');
    expect(screen.getByTestId('run-from-node-option')).toHaveAttribute('data-disabled');
  });

  it('enables run-to-node when a source node is selected', async () => {
    const user = userEvent.setup();
    mockStoreState.selectedNode = {
      data: { node_type: CanvasNodeTypeEnum.Source },
    } as typeof mockStoreState.selectedNode;

    render(<CanvasHeader {...defaultProps} />);
    await user.click(screen.getByTestId('run-button'));

    expect(screen.getByTestId('run-to-node-option')).not.toHaveAttribute('data-disabled');
    expect(screen.getByTestId('run-from-node-option')).not.toHaveAttribute('data-disabled');
  });
});
