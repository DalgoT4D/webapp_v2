/**
 * OperationNode Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OperationNode from '../nodes/OperationNode';
import * as usePermissionsHook from '@/hooks/api/usePermissions';
import { CanvasActionEnum, OperationFormAction } from '@/constants/transform';
import type { CanvasNodeRenderData } from '@/types/transform';

// ============ Mocks ============

jest.mock('@/hooks/api/usePermissions');

const mockDispatchCanvasAction = jest.fn();
const mockOpenOperationPanel = jest.fn();

jest.mock('@/stores/transformStore', () => ({
  useTransformStore: () => ({
    setSelectedNode: jest.fn(),
    dispatchCanvasAction: mockDispatchCanvasAction,
    openOperationPanel: mockOpenOperationPanel,
    clearPreviewAction: jest.fn(),
    canInteractWithCanvas: () => false,
  }),
  useSelectedNode: () => null,
}));

let mockEdges: { source: string }[] = [];

jest.mock('reactflow', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
  useEdges: () => mockEdges,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// ============ Test Data ============

const defaultProps = {
  id: 'op-1',
  type: 'operation',
  selected: false,
  xPos: 0,
  yPos: 0,
  zIndex: 0,
  isConnectable: true,
  dragging: false,
  data: {
    operation_config: { type: 'aggregate' },
  } as unknown as CanvasNodeRenderData,
};

// ============ OperationNode Tests ============

describe('OperationNode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEdges = [];

    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (perm: string) =>
        ['can_edit_dbt_operation', 'can_delete_dbt_operation'].includes(perm),
    });
  });

  it('renders node with operation label', () => {
    render(<OperationNode {...defaultProps} />);
    expect(screen.getByTestId('operation-node-op-1')).toBeInTheDocument();
    expect(screen.getByText('Aggregate')).toBeInTheDocument();
  });

  it('shows delete button for leaf nodes with delete permission', () => {
    render(<OperationNode {...defaultProps} />);
    expect(screen.getByTestId('delete-operation-op-1')).toBeInTheDocument();
  });

  it('hides delete button when node has outgoing edges (non-leaf)', () => {
    mockEdges = [{ source: 'op-1' }];
    render(<OperationNode {...defaultProps} />);
    expect(screen.queryByTestId('delete-operation-op-1')).not.toBeInTheDocument();
  });

  it('opens panel in EDIT mode when user has can_edit_dbt_operation', async () => {
    const user = userEvent.setup();
    render(<OperationNode {...defaultProps} />);

    await user.click(screen.getByTestId('operation-node-op-1'));

    expect(mockOpenOperationPanel).toHaveBeenCalled();
    expect(mockDispatchCanvasAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CanvasActionEnum.OPEN_OPCONFIG_PANEL,
        data: expect.objectContaining({ mode: OperationFormAction.EDIT }),
      })
    );
  });

  it('opens panel in VIEW mode when user only has can_view_dbt_operation', async () => {
    const user = userEvent.setup();
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: (perm: string) => perm === 'can_view_dbt_operation',
    });

    render(<OperationNode {...defaultProps} />);
    await user.click(screen.getByTestId('operation-node-op-1'));

    expect(mockOpenOperationPanel).toHaveBeenCalled();
    expect(mockDispatchCanvasAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CanvasActionEnum.OPEN_OPCONFIG_PANEL,
        data: expect.objectContaining({ mode: OperationFormAction.VIEW }),
      })
    );
  });

  it('does not open panel when user has neither edit nor view permission', async () => {
    const user = userEvent.setup();
    (usePermissionsHook.useUserPermissions as jest.Mock).mockReturnValue({
      hasPermission: () => false,
    });

    render(<OperationNode {...defaultProps} />);
    await user.click(screen.getByTestId('operation-node-op-1'));

    expect(mockOpenOperationPanel).not.toHaveBeenCalled();
  });
});
