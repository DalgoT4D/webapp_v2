// components/transform/canvas/__tests__/CanvasMessages.test.tsx
import { render, screen } from '@testing-library/react';
import CanvasMessages from '../CanvasMessages';
import {
  createLockedByOtherUser,
  createMockLockStatus,
  createLockedByCurrentUser,
} from './canvas-mock-data';

// Mock the transform store
const mockStoreState = {
  canvasLockStatus: null as ReturnType<typeof createMockLockStatus> | null,
};

jest.mock('@/stores/transformStore', () => ({
  useTransformStore: (selector: (state: typeof mockStoreState) => unknown) => {
    return selector(mockStoreState);
  },
}));

describe('CanvasMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState.canvasLockStatus = null;
  });

  it('renders nothing when no lock status', () => {
    const { container } = render(<CanvasMessages />);

    expect(container.querySelector('[data-testid="canvas-messages"]')).toBeNull();
  });

  it('renders nothing when canvas is not locked', () => {
    mockStoreState.canvasLockStatus = createMockLockStatus({ is_locked: false });

    const { container } = render(<CanvasMessages />);

    expect(container.querySelector('[data-testid="canvas-messages"]')).toBeNull();
  });

  it('shows lock message when canvas is locked by another user', () => {
    mockStoreState.canvasLockStatus = createLockedByOtherUser();

    render(<CanvasMessages />);

    expect(screen.getByTestId('canvas-message-lock-status')).toBeInTheDocument();
    expect(screen.getByText(/Locked/i)).toBeInTheDocument();
    expect(screen.getByText(/other-user@example.com/i)).toBeInTheDocument();
  });

  it('does not show lock message when locked by current user', () => {
    mockStoreState.canvasLockStatus = createLockedByCurrentUser();

    const { container } = render(<CanvasMessages />);

    expect(container.querySelector('[data-testid="canvas-message-lock-status"]')).toBeNull();
  });
});
