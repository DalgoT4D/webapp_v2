import type * as ReactModule from 'react';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import type { Edge, Node } from 'reactflow';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import type {
  CanvasAction,
  CanvasEdgeDataResponse,
  CanvasLockStatus,
  CanvasNodeDataResponse,
  CanvasNodePositionUpdate,
  CanvasNodeRenderData,
} from '@/types/transform';
import { createMockSourceNode } from './canvas-mock-data';

let mockReactFlowProps: Record<string, unknown> = {};
const mockSavePositions = jest.fn().mockResolvedValue([]);
const mockSetNodes = jest.fn();
const mockSetEdges = jest.fn();
let mockFlowNodes: Node<CanvasNodeRenderData>[] = [];
let mockApiNodes: CanvasNodeDataResponse[] = [];

interface MockTransformState {
  closeOperationPanel: jest.Mock;
  tempLockCanvas: boolean;
  lockUpperSection: boolean;
  isWorkflowRunning: boolean;
  canvasLockStatus: CanvasLockStatus;
  canInteractWithCanvas: () => boolean;
  clearCanvasAction: jest.Mock;
  clearPreviewAction: jest.Mock;
  setPreviewData: jest.Mock;
}

interface MockCanvasGraphResult {
  nodes: CanvasNodeDataResponse[];
  edges: CanvasEdgeDataResponse[];
  isLoading: boolean;
  refresh: jest.Mock;
}

interface MockCanvasLayoutResult {
  savePositions: jest.Mock<Promise<CanvasNodePositionUpdate[]>>;
  retryFailed: jest.Mock;
  isSaving: boolean;
  error: Error | null;
}

const mockTransformState: MockTransformState = {
  closeOperationPanel: jest.fn(),
  tempLockCanvas: false,
  lockUpperSection: false,
  isWorkflowRunning: false,
  canvasLockStatus: {
    is_locked: true,
    locked_by: 'engineer@example.com',
    locked_at: null,
    locked_by_current_user: true,
    lock_id: 'lock-token',
  },
  canInteractWithCanvas: () => true,
  clearCanvasAction: jest.fn(),
  clearPreviewAction: jest.fn(),
  setPreviewData: jest.fn(),
};

jest.mock('reactflow', () => {
  const React = jest.requireActual('react') as typeof ReactModule;
  return {
    __esModule: true,
    default: (props: Record<string, unknown>): ReactElement => {
      mockReactFlowProps = props;
      return React.createElement(
        'div',
        { 'data-testid': 'react-flow' },
        props.children as ReactNode
      );
    },
    Background: (): null => null,
    ControlButton: ({
      children,
      onClick,
      disabled,
      'data-testid': testId,
    }: {
      children: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
      'data-testid'?: string;
    }): ReactElement =>
      React.createElement('button', { onClick, disabled, 'data-testid': testId }, children),
    Controls: ({ children }: { children: ReactNode }): ReactElement =>
      React.createElement('div', null, children),
    MarkerType: { Arrow: 'arrow' },
    useNodesState: (): [Node<CanvasNodeRenderData>[], jest.Mock, jest.Mock] => [
      [],
      mockSetNodes,
      jest.fn(),
    ],
    useEdgesState: (): [Edge[], jest.Mock, jest.Mock] => [[], mockSetEdges, jest.fn()],
    useReactFlow: (): {
      setCenter: jest.Mock;
      fitView: jest.Mock;
      getNodes: () => Node<CanvasNodeRenderData>[];
      getEdges: () => Edge[];
    } => ({
      setCenter: jest.fn(),
      fitView: jest.fn(),
      getNodes: (): Node<CanvasNodeRenderData>[] => mockFlowNodes,
      getEdges: (): Edge[] => [],
    }),
  };
});

jest.mock('../nodes/DbtSourceModelNode', (): (() => null) => () => null);
jest.mock('../nodes/OperationNode', (): (() => null) => () => null);
jest.mock('../CanvasMessages', (): (() => null) => () => null);
jest.mock('@/hooks/api/useCanvasGraph', (): { useCanvasGraph: () => MockCanvasGraphResult } => ({
  useCanvasGraph: (): MockCanvasGraphResult => ({
    nodes: mockApiNodes,
    edges: [],
    isLoading: false,
    refresh: jest.fn(),
  }),
}));
jest.mock('@/hooks/api/useCanvasLayout', (): { useCanvasLayout: () => MockCanvasLayoutResult } => ({
  useCanvasLayout: (): MockCanvasLayoutResult => ({
    savePositions: mockSavePositions,
    retryFailed: jest.fn(),
    isSaving: false,
    error: null,
  }),
}));
jest.mock(
  '@/stores/transformStore',
  (): {
    useCanvasAction: () => CanvasAction;
    useTransformStore: (selector?: (state: MockTransformState) => unknown) => unknown;
  } => ({
    useCanvasAction: (): CanvasAction => ({ type: null, data: null }),
    useTransformStore: (selector?: (state: MockTransformState) => unknown): unknown =>
      selector ? selector(mockTransformState) : mockTransformState,
  })
);
jest.mock(
  '@/lib/toast',
  (): Record<string, unknown> => ({
    toastError: { api: jest.fn() },
  })
);
jest.mock(
  '@/lib/analytics',
  (): Record<string, unknown> => ({
    trackEvent: jest.fn(),
  })
);

import Canvas from '../Canvas';

describe('Canvas interaction persistence', () => {
  beforeEach(() => {
    mockReactFlowProps = {};
    mockSavePositions.mockClear();
    mockSetNodes.mockClear();
    mockSetEdges.mockClear();
    const { trackEvent } = jest.requireMock('@/lib/analytics') as { trackEvent: jest.Mock };
    trackEvent.mockClear();
    mockFlowNodes = [];
    mockApiNodes = [];
    mockTransformState.canvasLockStatus = {
      is_locked: true,
      locked_by: 'engineer@example.com',
      locked_at: null,
      locked_by_current_user: true,
      lock_id: 'lock-token',
    };
  });

  it('disables unsupported manual React Flow connections', () => {
    render(<Canvas />);

    expect(mockReactFlowProps.nodesConnectable).toBe(false);
    expect(mockReactFlowProps.onConnect).toBeUndefined();
  });

  it('disables canvas mutations when the current user does not own the lock', () => {
    mockTransformState.canvasLockStatus = {
      is_locked: true,
      locked_by: 'another@example.com',
      locked_at: null,
      locked_by_current_user: false,
      lock_id: null,
    };

    render(<Canvas />);

    expect(mockReactFlowProps.nodesDraggable).toBe(false);
    expect(mockReactFlowProps.onNodeDragStop).toBeUndefined();
    expect(screen.getByTestId('auto-arrange-canvas-button')).toBeDisabled();
  });

  it('persists the final top-left position when an owned node drag ends', async () => {
    render(<Canvas />);
    const nodeData = createMockSourceNode({ uuid: 'source' });
    const draggedNode = {
      id: 'source',
      type: 'source',
      data: { ...nodeData, isDummy: false },
      position: { x: 125, y: 175 },
    } as Node<CanvasNodeRenderData>;
    const onNodeDragStop = mockReactFlowProps.onNodeDragStop as (
      event: MouseEvent,
      node: Node<CanvasNodeRenderData>
    ) => void;

    await act(async () => {
      onNodeDragStop({} as MouseEvent, draggedNode);
      await Promise.resolve();
    });

    expect(mockSavePositions).toHaveBeenCalledWith([
      { uuid: 'source', position: { x: 125, y: 175 } },
    ]);
  });

  it('tracks auto-arrange after its layout save succeeds', async () => {
    const { trackEvent } = jest.requireMock('@/lib/analytics') as { trackEvent: jest.Mock };
    const nodeData = createMockSourceNode({
      uuid: 'source',
      position: { x: 125, y: 175 },
    });
    mockApiNodes = [nodeData];
    mockFlowNodes = [
      {
        id: 'source',
        type: 'source',
        data: { ...nodeData, isDummy: false },
        position: nodeData.position!,
      } as Node<CanvasNodeRenderData>,
    ];
    render(<Canvas />);

    fireEvent.click(screen.getByTestId('auto-arrange-canvas-button'));

    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.TRANSFORM_CANVAS_AUTO_ARRANGED, {
        node_count: 1,
      })
    );
  });
});
