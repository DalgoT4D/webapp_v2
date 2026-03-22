// components/transform/canvas/panels/OperationConfigLayout.tsx
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useReactFlow } from 'reactflow';
import { X, ChevronLeft, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { useSWRConfig } from 'swr';
import { useTransformStore, useSelectedNode, useCanvasAction } from '@/stores/transformStore';
import { CANVAS_GRAPH_KEY } from '@/hooks/api/useCanvasGraph';
import { OperationList } from './OperationList';
import { CreateTableOrAddFunction } from './CreateTableOrAddFunction';
import { getFormForOperation } from '../forms/formRegistry';
import { CanvasNodeTypeEnum, type UIOperationType, type SelectedNodeData } from '@/types/transform';
import { CANVAS_CONSTANTS, getOperationLabel } from '@/constants/transform';
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
  const { mutate } = useSWRConfig();
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

  // Process canvas action during render so form state is ready in the SAME render
  // cycle where open=true. This matches v1 which sets selectedOp immediately when
  // the panel opens, so the user sees the form directly (never the operation list).
  //
  // The key includes the node ID so clicking a different operation node (same action
  // type) is still treated as a new action.
  const lastProcessedActionRef = useRef<string | null>(null);

  if (canvasAction.type === 'open-opconfig-panel' && canvasAction.data) {
    const currentNode = useTransformStore.getState().selectedNode;
    const actionKey = `${canvasAction.type}-${currentNode?.id ?? 'none'}`;

    if (actionKey !== lastProcessedActionRef.current) {
      lastProcessedActionRef.current = actionKey;

      const actionData = canvasAction.data;
      const mode: FormMode =
        typeof actionData === 'string'
          ? (actionData as FormMode)
          : (actionData as { mode: FormMode }).mode || 'create';

      setFormMode(mode);

      if (mode === 'view' || mode === 'edit') {
        if (currentNode?.data?.operation_config?.type) {
          const existingOp = {
            slug: currentNode.data.operation_config.type,
            label: getOperationLabel(currentNode.data.operation_config.type),
          };
          setSelectedOp(existingOp);
          setPanelState('op-form');
        }
      } else {
        setPanelState('op-list');
        setSelectedOp(null);
      }
    }
  } else {
    // Action was cleared — reset the ref so the next action is processed
    lastProcessedActionRef.current = null;
  }

  // Clear the canvas action in an effect (Zustand mutations can't run during render)
  useEffect(() => {
    if (canvasAction.type === 'open-opconfig-panel' && canvasAction.data) {
      clearCanvasAction();
    }
  }, [canvasAction.type, clearCanvasAction]);

  // getOperationLabel imported from @/constants/transform

  // Create dummy node when operation selected
  const createDummyNode = useCallback(
    (operation: UIOperationType) => {
      // Read selectedNode directly from the store at call time to avoid stale closures.
      // This matches v1 which reads canvasNode from context at call time.
      const currentNode = useTransformStore.getState().selectedNode;
      if (!currentNode) return;

      const dummyId = `dummy-${Date.now()}`;
      dummyNodeIdRef.current = dummyId;

      // Use position stored on selectedNode (set during click, like v1's xPos/yPos).
      // Fallback: look up position from React Flow state.
      let sourcePosition = currentNode.position;
      if (!sourcePosition) {
        const flowNode = getNodes().find((n) => n.id === currentNode.id);
        sourcePosition = flowNode?.position || { x: 0, y: 0 };
      }

      // Position to the right of the source node, matching the LR dagre layout
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
        source: currentNode.id,
        target: dummyId,
        type: 'default',
        animated: true,
        style: { strokeDasharray: '5,5' },
      };

      setNodes((prevNodes) => [...prevNodes, dummyNode]);
      setEdges((prevEdges) => [...prevEdges, dummyEdge]);
    },
    [setNodes, setEdges, getNodes]
  );

  // Clean up dummy nodes and any orphan dummy edges
  const cleanupDummyNodes = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();

    const dummyNodeIds = nodes.filter((n) => n.data?.isDummy).map((n) => n.id);

    // Also find orphan dummy edges (source: edge-dummy-*) whose source/target nodes
    // may have already been removed by Canvas's setNodes after graph refresh
    const dummyEdgeIds = edges
      .filter(
        (e) =>
          dummyNodeIds.includes(e.source) ||
          dummyNodeIds.includes(e.target) ||
          e.id.startsWith('edge-dummy-')
      )
      .map((e) => e.id);

    if (dummyNodeIds.length > 0 || dummyEdgeIds.length > 0) {
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
      // Go back to the edit form for the current operation, not the op list
      if (selectedNode?.data?.operation_config?.type) {
        const opSlug = selectedNode.data.operation_config.type;
        const op = { slug: opSlug, label: getOperationLabel(opSlug) };
        setSelectedOp(op);
        setFormMode('edit');
        setPanelState('op-form');
      } else {
        // Fallback to op-list if no operation is found
        setPanelState('op-list');
        setSelectedOp(null);
      }
    }
  }, [panelState, formMode, cleanupDummyNodes]);

  // Track whether to show "Add Function" in the create-table-or-add-function panel
  const [showAddFunction, setShowAddFunction] = useState(true);

  // After operation saved — swap dummy for real node at dummy's position FIRST,
  // then refresh graph so Canvas.tsx sees the real node already positioned and
  // preserves it via currentPosMap. New nodes (e.g. second table in union/join)
  // get positioned via the shift calculation in Canvas.tsx.
  const handleContinueOperationChain = useCallback(
    async (...args: unknown[]) => {
      // First arg is the new operation node UUID (from createOperation response)
      // For edits, it will be undefined — use selectedNode.id as fallback
      const newNodeUuid = (args[0] as string | undefined) || selectedNode?.id;
      const dummyId = dummyNodeIdRef.current;

      if (newNodeUuid && dummyId && newNodeUuid !== dummyId) {
        // --- Swap dummy operation node for real node at the same position ---
        const currentNodes = getNodes();
        const currentEdges = getEdges();
        const dummyNode = currentNodes.find((n) => n.id === dummyId);
        const dummyEdges = currentEdges.filter((e) => e.source === dummyId || e.target === dummyId);

        if (dummyNode) {
          const realNode = {
            id: newNodeUuid,
            type: CanvasNodeTypeEnum.Operation as string,
            position: { ...dummyNode.position },
            data: {
              ...dummyNode.data,
              uuid: newNodeUuid,
              isDummy: false,
            },
          };

          // Remap edges from dummy → real node
          const realEdges = dummyEdges.map((edge) => {
            const source = edge.source === dummyId ? newNodeUuid : edge.source;
            const target = edge.target === dummyId ? newNodeUuid : edge.target;
            return {
              id: `${source}_${target}`,
              source,
              target,
              sourceHandle: edge.sourceHandle,
              targetHandle: edge.targetHandle,
            };
          });

          // Swap: remove dummy, add real node + remapped edges
          setNodes((prev) => [...prev.filter((n) => n.id !== dummyId), realNode]);
          setEdges((prev) => [
            ...prev.filter((e) => !dummyEdges.some((de) => de.id === e.id)),
            ...realEdges,
          ]);
        } else {
          cleanupDummyNodes();
        }
      } else {
        // Edit mode or no dummy — just clean up
        cleanupDummyNodes();
      }

      dummyNodeIdRef.current = null;

      // Now refresh graph to get full node data from API.
      // The real operation node is already on the canvas with the correct position,
      // so Canvas.tsx's incremental update will preserve it via currentPosMap.
      // Any new nodes (e.g. second table in union) get positioned via shift calculation.
      await mutate(CANVAS_GRAPH_KEY);

      // Small delay to allow React Flow to process the refreshed nodes
      await new Promise((resolve) => setTimeout(resolve, 150));

      if (newNodeUuid) {
        const nodes = getNodes();
        const newNode = nodes.find((n) => n.id === newNodeUuid);
        if (newNode) {
          setSelectedNode(newNode as unknown as SelectedNodeData);
          const savedOpType = newNode.data?.operation_config?.type;
          const isChainTerminal = savedOpType === 'rawsql';
          setShowAddFunction(!isChainTerminal);
        } else {
          setSelectedNode({
            id: newNodeUuid,
            type: 'operation',
            data: { uuid: newNodeUuid, node_type: CanvasNodeTypeEnum.Operation },
          } as unknown as SelectedNodeData);
          const isChainTerminal = selectedOp?.slug === 'rawsql';
          setShowAddFunction(!isChainTerminal);
        }
      }

      setPanelState('create-table-or-add-function');
    },
    [
      cleanupDummyNodes,
      getNodes,
      getEdges,
      setNodes,
      setEdges,
      setSelectedNode,
      selectedNode?.id,
      selectedOp,
      mutate,
    ]
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
              key={selectedNode?.id}
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
            showAddFunction={showAddFunction}
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
                aria-label="Go back"
                data-testid="panel-back-btn"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <h2 className="font-semibold text-lg">{getHeaderTitle()}</h2>
            {panelState === 'op-form' && selectedOp?.infoToolTip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-[200px]">{selectedOp.infoToolTip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-8 w-8"
            aria-label="Close panel"
            data-testid="panel-close-btn"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Loading indicator */}
        {isPanelLoading && (
          <div className="h-1 bg-primary animate-pulse" data-testid="panel-loading" />
        )}

        {/* Content */}
        <div className="relative flex-1 min-h-0 overflow-y-auto">
          {renderContent()}

          {/* Backdrop overlay during form save — prevents double-submit */}
          {isPanelLoading && (
            <div className="absolute inset-0 bg-white/70 z-10" data-testid="panel-backdrop" />
          )}
        </div>
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
