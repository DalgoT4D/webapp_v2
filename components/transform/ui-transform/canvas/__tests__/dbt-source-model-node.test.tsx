/**
 * DbtSourceModelNode Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DbtSourceModelNode from '../nodes/DbtSourceModelNode';
import * as usePermissionsHook from '@/hooks/api/usePermissions';
import { CanvasActionEnum, OperationFormAction } from '@/constants/transform';
import type { CanvasNodeRenderData } from '@/types/transform';

// ============ Mocks ============

jest.mock('@/hooks/api/usePermissions');

const mockDispatchCanvasAction = jest.fn();
const mockSetSelectedNode = jest.fn();
const mockOpenOperationPanel = jest.fn();

jest.mock('@/stores/transformStore', () => ({
  useTransformStore: () => ({
    setSelectedNode: mockSetSelectedNode,
    dispatchCanvasAction: mockDispatchCanvasAction,
    setPreviewData: jest.fn(),
    clearPreviewAction: jest.fn(),
    openOperationPanel: mockOpenOperationPanel,
    canInteractWithCanvas: () => false,
  }),
}));

let mockEdges: { source: string }[] = [];

jest.mock('reactflow', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
  useEdges: () => mockEdges,
}));

// ============ Test Data ============

const defaultProps = {
  id: 'node-1',
  type: 'model',
  selected: false,
  xPos: 0,
  yPos: 0,
  zIndex: 0,
  isConnectable: true,
  dragging: false,
  data: {
    name: 'orders',
    dbtmodel: { name: 'orders', schema: 'public' },
  } as unknown as CanvasNodeRenderData,
};

// ============ DbtSourceModelNode Tests ============

describe('DbtSourceModelNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEdges = [];

    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (perm: string) =>
        ['can_delete_dbt_model', 'can_create_dbt_model'].includes(perm),
    });
  });

  it('renders node with table name and schema', () => {
    render(<DbtSourceModelNode {...defaultProps} />);
    expect(screen.getByTestId('source-model-node-node-1')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
    expect(screen.getByText('public')).toBeInTheDocument();
  });

  it('shows delete button only for leaf nodes with delete permission', () => {
    // Leaf node (no outgoing edges) + has permission → button shown
    render(<DbtSourceModelNode {...defaultProps} />);
    expect(screen.getByTestId('delete-node-node-1')).toBeInTheDocument();
  });

  it('hides delete button when node has outgoing edges (non-leaf)', () => {
    mockEdges = [{ source: 'node-1' }];
    render(<DbtSourceModelNode {...defaultProps} />);
    expect(screen.queryByTestId('delete-node-node-1')).not.toBeInTheDocument();
  });

  it('hides delete button when user lacks can_delete_dbt_model permission', () => {
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: () => false,
    });

    render(<DbtSourceModelNode {...defaultProps} />);
    expect(screen.queryByTestId('delete-node-node-1')).not.toBeInTheDocument();
  });

  it('dispatches DELETE_NODE action when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<DbtSourceModelNode {...defaultProps} />);

    await user.click(screen.getByTestId('delete-node-node-1'));

    expect(mockDispatchCanvasAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: CanvasActionEnum.DELETE_NODE })
    );
  });

  it('opens operation panel when node is clicked and user has can_create_dbt_model', async () => {
    const user = userEvent.setup();
    render(<DbtSourceModelNode {...defaultProps} />);

    await user.click(screen.getByTestId('source-model-node-node-1'));

    expect(mockOpenOperationPanel).toHaveBeenCalled();
    expect(mockDispatchCanvasAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CanvasActionEnum.OPEN_OPCONFIG_PANEL,
        data: expect.objectContaining({ mode: OperationFormAction.CREATE }),
      })
    );
  });

  it('does not open panel when user lacks can_create_dbt_model', async () => {
    const user = userEvent.setup();
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: () => false,
    });

    render(<DbtSourceModelNode {...defaultProps} />);
    await user.click(screen.getByTestId('source-model-node-node-1'));

    expect(mockOpenOperationPanel).not.toHaveBeenCalled();
  });
});
