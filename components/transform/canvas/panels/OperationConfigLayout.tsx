// components/transform/canvas/panels/OperationConfigLayout.tsx
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from 'reactflow';
import { X, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTransformStore, useSelectedNode, useCanvasAction } from '@/stores/transformStore';
import { OperationList } from './OperationList';
import { CreateTableOrAddFunction } from './CreateTableOrAddFunction';
import { getFormForOperation } from '../forms';
import { CanvasNodeTypeEnum, type UIOperationType, type GenericNodeProps } from '@/types/transform';
import { CANVAS_CONSTANTS } from '@/constants/transform';
import { cn } from '@/lib/utils';

type PanelState = 'op-list' | 'op-form' | 'create-table-or-add-function';
type FormMode = 'create' | 'view' | 'edit';

interface OperationConfigLayoutProps {
  /** Whether the panel is open */
  open: boolean;
  /** Callback to close the panel */
  onClose: () => void;
}

/**
 * Main orchestrator for operation configuration.
 * Manages panel states, renders operation list or forms,
 * handles dummy node creation/cleanup.
 */
export function OperationConfigLayout({ open, onClose }: OperationConfigLayoutProps) {
  const { deleteElements, getNodes, setNodes, setEdges, getEdges } = useReactFlow();
  const selectedNode = useSelectedNode();
  const canvasAction = useCanvasAction();
  const { closeOperationPanel, setSelectedNode, clearCanvasAction } = useTransformStore();

  // Panel state
  const [panelState, setPanelState] = useState<PanelState>('op-list');
  const [selectedOp, setSelectedOp] = useState<UIOperationType | null>(null);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Track dummy node for cleanup
  const dummyNodeIdRef = useRef<string | null>(null);

  // Determine if selected node can chain operations in middle
  const canChainInMiddle = selectedNode?.data?.node_type !== CanvasNodeTypeEnum.Operation;

  // Handle canvas action changes
  useEffect(() => {
    if (canvasAction.type !== 'open-opconfig-panel' || !canvasAction.data) {
      return;
    }

    // Handle both string data ('create') and object data ({ mode: 'create' })
    const actionData = canvasAction.data;
    const mode: FormMode =
      typeof actionData === 'string'
        ? (actionData as FormMode)
        : (actionData as { mode: FormMode }).mode || 'create';

    setFormMode(mode);

    if (mode === 'view' || mode === 'edit') {
      // For view/edit, go directly to form with existing operation
      if (selectedNode?.data?.operation_config?.type) {
        const existingOp = {
          slug: selectedNode.data.operation_config.type,
          label: getOperationLabel(selectedNode.data.operation_config.type),
        };
        setSelectedOp(existingOp);
        setPanelState('op-form');
      }
    } else {
      // For create, show operation list
      setPanelState('op-list');
      setSelectedOp(null);
    }

    clearCanvasAction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasAction.type]);

  // Get operation label from slug
  const getOperationLabel = useCallback((slug: string): string => {
    const opLabels: Record<string, string> = {
      renamecolumns: 'Rename',
      flattenjson: 'Flatten JSON',
      castdatatypes: 'Cast',
      coalescecolumns: 'Coalesce',
      arithmetic: 'Arithmetic',
      dropcolumns: 'Drop',
      replace: 'Replace',
      join: 'Join',
      where: 'Filter',
      groupby: 'Group By',
      aggregate: 'Aggregate',
      casewhen: 'Case',
      unionall: 'Table union',
      pivot: 'Pivot',
      unpivot: 'Unpivot',
      generic: 'Generic Column',
      rawsql: 'Generic SQL',
      'create-table': 'Create Table',
    };
    return opLabels[slug] || slug;
  }, []);

  // Create dummy node when operation selected
  const createDummyNode = useCallback(
    (operation: UIOperationType) => {
      if (!selectedNode) return;

      const dummyId = `dummy-${Date.now()}`;
      dummyNodeIdRef.current = dummyId;

      // Get source node position from React Flow
      const nodes = getNodes();
      const sourceNode = nodes.find((n) => n.id === selectedNode.id);
      const sourcePosition = sourceNode?.position || { x: 0, y: 0 };

      const dummyNode = {
        id: dummyId,
        type: CanvasNodeTypeEnum.Operation,
        position: {
          x: sourcePosition.x + CANVAS_CONSTANTS.DAGRE_RANK_SEP,
          y: sourcePosition.y,
        },
        data: {
          uuid: dummyId,
          name: operation.label,
          output_columns: [] as string[],
          node_type: CanvasNodeTypeEnum.Operation,
          dbtmodel: null as null,
          operation_config: {
            type: operation.slug,
            config: {} as Record<string, unknown>,
          },
          input_nodes: [] as unknown[],
          is_last_in_chain: true,
          isPublished: null as boolean | null,
          isDummy: true,
        },
      };

      const dummyEdge = {
        id: `edge-dummy-${dummyId}`,
        source: selectedNode.id,
        target: dummyId,
        type: 'default',
        animated: true,
        style: { strokeDasharray: '5,5' },
      };

      setNodes((prevNodes) => [...prevNodes, dummyNode]);
      setEdges((prevEdges) => [...prevEdges, dummyEdge]);
    },
    [selectedNode, setNodes, setEdges, getNodes]
  );

  // Clean up dummy nodes
  const cleanupDummyNodes = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();

    const dummyNodeIds = nodes.filter((n) => n.data?.isDummy).map((n) => n.id);
    const dummyEdgeIds = edges
      .filter((e) => dummyNodeIds.includes(e.source) || dummyNodeIds.includes(e.target))
      .map((e) => e.id);

    if (dummyNodeIds.length > 0) {
      deleteElements({
        nodes: dummyNodeIds.map((id) => ({ id })),
        edges: dummyEdgeIds.map((id) => ({ id })),
      });
    }

    dummyNodeIdRef.current = null;
  }, [getNodes, getEdges, deleteElements]);

  // Handle operation selection
  const handleSelectOperation = useCallback(
    (operation: UIOperationType) => {
      // Clean up any existing dummy nodes
      cleanupDummyNodes();

      // Create new dummy node
      createDummyNode(operation);

      setSelectedOp(operation);
      setFormMode('create');
      setPanelState('op-form');
    },
    [cleanupDummyNodes, createDummyNode]
  );

  // Handle close with confirmation if needed
  const handleClose = useCallback(() => {
    if (panelState === 'op-form' && formMode === 'create') {
      setShowDiscardDialog(true);
    } else {
      cleanupDummyNodes();
      setPanelState('op-list');
      setSelectedOp(null);
      setFormMode('create');
      onClose();
    }
  }, [panelState, formMode, cleanupDummyNodes, onClose]);

  // Handle discard confirmation
  const handleConfirmDiscard = useCallback(() => {
    cleanupDummyNodes();
    setPanelState('op-list');
    setSelectedOp(null);
    setFormMode('create');
    setShowDiscardDialog(false);
    onClose();
  }, [cleanupDummyNodes, onClose]);

  // Handle back button
  const handleBack = useCallback(() => {
    if (panelState === 'op-form' && formMode === 'create') {
      cleanupDummyNodes();
      setPanelState('op-list');
      setSelectedOp(null);
    } else if (panelState === 'create-table-or-add-function') {
      setPanelState('op-list');
      setSelectedOp(null);
    }
  }, [panelState, formMode, cleanupDummyNodes]);

  // After operation saved successfully — update selectedNode to the real operation node
  const handleContinueOperationChain = useCallback(
    (...args: unknown[]) => {
      cleanupDummyNodes();

      // First arg is the new operation node UUID (passed from form after createOperation)
      const newNodeUuid = args[0] as string | undefined;

      if (newNodeUuid) {
        // Find the node in the React Flow graph by UUID
        const nodes = getNodes();
        const newNode = nodes.find((n) => n.id === newNodeUuid);
        if (newNode) {
          setSelectedNode(newNode as unknown as GenericNodeProps);
        } else {
          // Node might not be in graph yet — create a minimal selectedNode reference
          setSelectedNode({
            id: newNodeUuid,
            type: 'operation',
            data: { uuid: newNodeUuid, node_type: CanvasNodeTypeEnum.Operation },
          } as unknown as GenericNodeProps);
        }
      }

      setPanelState('create-table-or-add-function');
    },
    [cleanupDummyNodes, getNodes, setSelectedNode]
  );

  // User chose to create a table
  const handleCreateTable = useCallback(() => {
    setSelectedOp({ slug: 'create-table', label: 'Create Table' });
    setFormMode('create');
    setPanelState('op-form');
  }, []);

  // User chose to add another function
  const handleAddFunction = useCallback(() => {
    setPanelState('op-list');
    setSelectedOp(null);
  }, []);

  // Clear and close panel
  const handleClearAndClosePanel = useCallback(() => {
    cleanupDummyNodes();
    setPanelState('op-list');
    setSelectedOp(null);
    setFormMode('create');
    closeOperationPanel();
    onClose();
  }, [cleanupDummyNodes, closeOperationPanel, onClose]);

  // Render header title
  const getHeaderTitle = () => {
    if (panelState === 'op-list') return 'Functions';
    if (selectedOp) return selectedOp.label;
    return 'Operation';
  };

  // Show back button?
  const showBackButton =
    (panelState === 'op-form' && formMode === 'create') ||
    panelState === 'create-table-or-add-function';

  // Render panel content
  const renderContent = () => {
    switch (panelState) {
      case 'op-list':
        return (
          <OperationList onSelect={handleSelectOperation} canChainInMiddle={canChainInMiddle} />
        );

      case 'op-form':
        if (!selectedOp) {
          return (
            <div className="p-6 text-center text-muted-foreground">
              <p>No operation selected</p>
            </div>
          );
        }

        const FormComponent = getFormForOperation(selectedOp.slug);

        if (!FormComponent) {
          return (
            <div className="p-6 text-center text-muted-foreground">
              <p className="text-base">Form not implemented: {selectedOp.label}</p>
              <p className="text-sm mt-2">Operation slug: {selectedOp.slug}</p>
            </div>
          );
        }

        return (
          <div className="flex-1 overflow-y-auto">
            <FormComponent
              node={selectedNode}
              operation={selectedOp}
              continueOperationChain={handleContinueOperationChain}
              clearAndClosePanel={handleClearAndClosePanel}
              dummyNodeId={dummyNodeIdRef.current || undefined}
              action={formMode}
              setLoading={setIsPanelLoading}
            />
          </div>
        );

      case 'create-table-or-add-function':
        return (
          <CreateTableOrAddFunction
            onCreateTable={handleCreateTable}
            onAddFunction={handleAddFunction}
            showAddFunction={true}
          />
        );

      default:
        return null;
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className={cn(
          'absolute top-0 right-0 h-full bg-white border-l shadow-lg z-20',
          'flex flex-col'
        )}
        style={{ width: CANVAS_CONSTANTS.OPERATION_PANEL_WIDTH }}
        data-testid="operation-config-layout"
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            {showBackButton && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-8 w-8"
                data-testid="panel-back-btn"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <h2 className="font-semibold text-lg">{getHeaderTitle()}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8"
            data-testid="panel-close-btn"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Loading indicator */}
        {isPanelLoading && (
          <div className="h-1 bg-teal-600 animate-pulse" data-testid="panel-loading" />
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">{renderContent()}</div>
      </div>

      {/* Discard Dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscard}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
