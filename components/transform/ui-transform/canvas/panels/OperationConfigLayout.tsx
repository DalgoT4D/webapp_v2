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
import {
  CANVAS_CONSTANTS,
  getOperationLabel,
  OperationFormAction,
  OperationPanelState,
  CanvasActionEnum,
} from '@/constants/transform';
import { cn } from '@/lib/utils';
import { useDummyNodeManager } from '../layout/hooks/useDummyNodeManager';

// PanelState → OperationPanelState, FormMode → OperationFormAction (imported from constants/transform)

interface OperationConfigLayoutProps {
  /** Whether the panel is open */
  open: boolean;
  /** Callback to close the panel */
  onClose: () => void;
}

/**
 * Main orchestrator for operation configuration.
 * Manages panel states, renders operation list or forms,
 * delegates dummy node creation/cleanup to useDummyNodeManager.
 */
export function OperationConfigLayout({ open, onClose }: OperationConfigLayoutProps) {
  const { getNodes } = useReactFlow();
  const { mutate } = useSWRConfig();
  const selectedNode = useSelectedNode();
  const canvasAction = useCanvasAction();
  const { closeOperationPanel, setSelectedNode, clearCanvasAction } = useTransformStore();

  // Dummy node management (create, cleanup, swap)
  const { dummyNodeIdRef, createDummyNode, cleanupDummyNodes, swapDummyForRealNode } =
    useDummyNodeManager();

  // Panel state
  const [panelState, setPanelState] = useState<OperationPanelState>(OperationPanelState.OP_LIST);
  const [selectedOp, setSelectedOp] = useState<UIOperationType | null>(null);
  const [formMode, setFormMode] = useState<OperationFormAction>(OperationFormAction.CREATE);
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Determine if selected node can chain operations in middle
  const canChainInMiddle = selectedNode?.data?.node_type !== CanvasNodeTypeEnum.Operation;

  // Process canvas action during render so form state is ready in the SAME render
  // cycle where open=true. This matches v1 which sets selectedOp immediately when
  // the panel opens, so the user sees the form directly (never the operation list).
  //
  // The key includes the node ID so clicking a different operation node (same action
  // type) is still treated as a new action.
  const lastProcessedActionRef = useRef<string | null>(null);

  if (canvasAction.type === CanvasActionEnum.OPEN_OPCONFIG_PANEL && canvasAction.data) {
    const currentNode = useTransformStore.getState().selectedNode;
    const actionKey = `${canvasAction.type}-${currentNode?.id ?? 'none'}`;

    if (actionKey !== lastProcessedActionRef.current) {
      lastProcessedActionRef.current = actionKey;

      const actionData = canvasAction.data;
      const mode: OperationFormAction =
        typeof actionData === 'string'
          ? (actionData as OperationFormAction)
          : (actionData as { mode: OperationFormAction }).mode || OperationFormAction.CREATE;

      setFormMode(mode);

      if (mode === OperationFormAction.VIEW || mode === OperationFormAction.EDIT) {
        if (currentNode?.data?.operation_config?.type) {
          const existingOp = {
            slug: currentNode.data.operation_config.type,
            label: getOperationLabel(currentNode.data.operation_config.type),
          };
          setSelectedOp(existingOp);
          setPanelState(OperationPanelState.OP_FORM);
        }
      } else {
        setPanelState(OperationPanelState.OP_LIST);
        setSelectedOp(null);
      }
    }
  } else {
    // Action was cleared — reset the ref so the next action is processed
    lastProcessedActionRef.current = null;
  }

  // Clear the canvas action in an effect (Zustand mutations can't run during render)
  useEffect(() => {
    if (canvasAction.type === CanvasActionEnum.OPEN_OPCONFIG_PANEL && canvasAction.data) {
      clearCanvasAction();
    }
  }, [canvasAction.type, clearCanvasAction]);

  // Clean up dummy nodes when panel is closed externally (e.g. canvas pane click)
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (prevOpenRef.current && !open) {
      cleanupDummyNodes();
      setPanelState(OperationPanelState.OP_LIST);
      setSelectedOp(null);
      setFormMode(OperationFormAction.CREATE);
    }
    prevOpenRef.current = open;
  }, [open, cleanupDummyNodes]);

  // Handle operation selection
  const handleSelectOperation = useCallback(
    (operation: UIOperationType) => {
      // Clean up any existing dummy nodes
      cleanupDummyNodes();

      // Create new dummy node
      createDummyNode(operation);

      setSelectedOp(operation);
      setFormMode(OperationFormAction.CREATE);
      setPanelState(OperationPanelState.OP_FORM);
    },
    [cleanupDummyNodes, createDummyNode]
  );

  // Handle close with confirmation if needed
  const handleClose = useCallback(() => {
    if (panelState === OperationPanelState.OP_FORM && formMode === OperationFormAction.CREATE) {
      setShowDiscardDialog(true);
    } else {
      cleanupDummyNodes();
      setPanelState(OperationPanelState.OP_LIST);
      setSelectedOp(null);
      setFormMode(OperationFormAction.CREATE);
      onClose();
    }
  }, [panelState, formMode, cleanupDummyNodes, onClose]);

  // Handle discard confirmation
  const handleConfirmDiscard = useCallback(() => {
    cleanupDummyNodes();
    setPanelState(OperationPanelState.OP_LIST);
    setSelectedOp(null);
    setFormMode(OperationFormAction.CREATE);
    setShowDiscardDialog(false);
    onClose();
  }, [cleanupDummyNodes, onClose]);

  // Handle back button
  const handleBack = useCallback(() => {
    if (panelState === OperationPanelState.OP_FORM && formMode === OperationFormAction.CREATE) {
      cleanupDummyNodes();
      setPanelState(OperationPanelState.OP_LIST);
      setSelectedOp(null);
    } else if (panelState === OperationPanelState.CREATE_TABLE_OR_ADD_FUNCTION) {
      // Go back to the edit form for the current operation, not the op list
      if (selectedNode?.data?.operation_config?.type) {
        const opSlug = selectedNode.data.operation_config.type;
        const op = { slug: opSlug, label: getOperationLabel(opSlug) };
        setSelectedOp(op);
        setFormMode(OperationFormAction.EDIT);
        setPanelState(OperationPanelState.OP_FORM);
      } else {
        // Fallback to op-list if no operation is found
        setPanelState(OperationPanelState.OP_LIST);
        setSelectedOp(null);
      }
    }
  }, [panelState, formMode, cleanupDummyNodes]);

  // Track whether to show "Add Function" in the create-table-or-add-function panel
  const [showAddFunction, setShowAddFunction] = useState(true);

  // After operation saved — swap dummy for real node, refresh graph,
  // then transition to create-table-or-add-function panel.
  const handleContinueOperationChain = useCallback(
    async (...args: unknown[]) => {
      // First arg is the new operation node UUID (from createOperation response)
      // For edits, it will be undefined — use selectedNode.id as fallback
      const newNodeUuid = (args[0] as string | undefined) || selectedNode?.id;

      if (newNodeUuid) {
        swapDummyForRealNode(newNodeUuid);
      } else {
        cleanupDummyNodes();
      }

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

      setPanelState(OperationPanelState.CREATE_TABLE_OR_ADD_FUNCTION);
    },
    [
      swapDummyForRealNode,
      cleanupDummyNodes,
      getNodes,
      setSelectedNode,
      selectedNode?.id,
      selectedOp,
      mutate,
    ]
  );

  // User chose to create a table
  const handleCreateTable = useCallback(() => {
    setSelectedOp({ slug: 'create-table', label: 'Create Table' });
    setFormMode(OperationFormAction.CREATE);
    setPanelState(OperationPanelState.OP_FORM);
  }, []);

  // User chose to add another function
  const handleAddFunction = useCallback(() => {
    setPanelState(OperationPanelState.OP_LIST);
    setSelectedOp(null);
  }, []);

  // Clear and close panel
  const handleClearAndClosePanel = useCallback(() => {
    cleanupDummyNodes();
    setPanelState(OperationPanelState.OP_LIST);
    setSelectedOp(null);
    setFormMode(OperationFormAction.CREATE);
    closeOperationPanel();
    onClose();
  }, [cleanupDummyNodes, closeOperationPanel, onClose]);

  // Render header title
  const getHeaderTitle = () => {
    if (panelState === OperationPanelState.OP_LIST) return 'Functions';
    if (selectedOp) return selectedOp.label;
    return 'Operation';
  };

  // Show back button?
  const showBackButton =
    (panelState === OperationPanelState.OP_FORM && formMode === OperationFormAction.CREATE) ||
    panelState === OperationPanelState.CREATE_TABLE_OR_ADD_FUNCTION;

  // Render panel content
  const renderContent = () => {
    switch (panelState) {
      case OperationPanelState.OP_LIST:
        return (
          <OperationList onSelect={handleSelectOperation} canChainInMiddle={canChainInMiddle} />
        );

      case OperationPanelState.OP_FORM:
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
          <div>
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

      case OperationPanelState.CREATE_TABLE_OR_ADD_FUNCTION:
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
            {panelState === OperationPanelState.OP_FORM && selectedOp?.infoToolTip && (
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
