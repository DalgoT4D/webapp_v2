// components/transform/canvas/__tests__/CanvasMessages.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CanvasMessages from '../CanvasMessages';
import {
  createLockedByOtherUser,
  createMockLockStatus,
  createLockedByCurrentUser,
} from './canvas-mock-data';

// Mock the transform store
const mockOpenPatModal = jest.fn();
const mockStoreState = {
  canvasLockStatus: null as ReturnType<typeof createMockLockStatus> | null,
  isViewOnlyMode: false,
  patRequired: false,
  openPatModal: mockOpenPatModal,
};

jest.mock('@/stores/transformStore', () => ({
  useTransformStore: (selector: (state: typeof mockStoreState) => unknown) => {
    return selector(mockStoreState);
  },
}));

describe('CanvasMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    mockStoreState.canvasLockStatus = null;
    mockStoreState.isViewOnlyMode = false;
    mockStoreState.patRequired = false;
  });

  it('renders nothing when no messages should be shown', () => {
    mockStoreState.canvasLockStatus = createMockLockStatus({ is_locked: false });

    const { container } = render(<CanvasMessages hasUnpublishedChanges={false} />);

    expect(container.querySelector('[data-testid="canvas-messages"]')).toBeNull();
  });

  it('shows lock message when canvas is locked by another user', () => {
    mockStoreState.canvasLockStatus = createLockedByOtherUser();

    render(<CanvasMessages hasUnpublishedChanges={false} />);

    expect(screen.getByTestId('canvas-message-lock-status')).toBeInTheDocument();
    expect(screen.getByText(/Locked/i)).toBeInTheDocument();
    expect(screen.getByText(/other-user@example.com/i)).toBeInTheDocument();
  });

  it('does not show lock message when locked by current user', () => {
    mockStoreState.canvasLockStatus = createLockedByCurrentUser();

    const { container } = render(<CanvasMessages hasUnpublishedChanges={false} />);

    expect(container.querySelector('[data-testid="canvas-message-lock-status"]')).toBeNull();
  });

  it('shows unpublished changes message', () => {
    mockStoreState.canvasLockStatus = createMockLockStatus();

    render(<CanvasMessages hasUnpublishedChanges={true} />);

    expect(screen.getByTestId('canvas-message-unpublished-changes')).toBeInTheDocument();
    expect(screen.getByText(/unpublished changes/i)).toBeInTheDocument();
  });

  it('shows PAT required message when in view-only mode', () => {
    mockStoreState.canvasLockStatus = createMockLockStatus();
    mockStoreState.patRequired = true;
    mockStoreState.isViewOnlyMode = true;

    render(<CanvasMessages hasUnpublishedChanges={false} />);

    expect(screen.getByTestId('canvas-message-pat-required')).toBeInTheDocument();
    expect(screen.getByText(/Update key to make changes/i)).toBeInTheDocument();
  });

  it('calls openPatModal when add key link is clicked', async () => {
    mockStoreState.canvasLockStatus = createMockLockStatus();
    mockStoreState.patRequired = true;
    mockStoreState.isViewOnlyMode = true;

    render(<CanvasMessages hasUnpublishedChanges={false} />);

    const addKeyLink = screen.getByTestId('add-pat-link');
    await userEvent.click(addKeyLink);

    expect(mockOpenPatModal).toHaveBeenCalledTimes(1);
  });

  it('shows multiple messages when applicable', () => {
    mockStoreState.canvasLockStatus = createLockedByOtherUser();
    mockStoreState.patRequired = true;
    mockStoreState.isViewOnlyMode = true;

    render(<CanvasMessages hasUnpublishedChanges={true} />);

    expect(screen.getByTestId('canvas-message-lock-status')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-message-unpublished-changes')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-message-pat-required')).toBeInTheDocument();
  });
});
