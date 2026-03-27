// stores/transformStore.ts
'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  SelectedNodeData,
  DbtModelResponse,
  CanvasAction,
  PreviewTableData,
  CanvasLockStatus,
  TaskProgressLog,
  PreviewAction,
} from '@/types/transform';

type LowerSectionTab = 'preview' | 'logs' | 'data statistics';

interface TransformState {
  // Tab state
  activeTab: 'ui' | 'github';
  setActiveTab: (tab: 'ui' | 'github') => void;

  // Workspace state
  workspaceSetup: boolean;
  setWorkspaceSetup: (setup: boolean) => void;

  // Git connection
  gitConnected: boolean;
  setGitConnected: (connected: boolean) => void;

  // === Canvas Node Selection ===
  selectedNode: SelectedNodeData | null;
  setSelectedNode: (node: SelectedNodeData | null) => void;
  clearSelectedNode: () => void;

  // === Canvas Actions (Event Bus) ===
  canvasAction: CanvasAction;
  dispatchCanvasAction: (action: CanvasAction) => void;
  clearCanvasAction: () => void;

  // === Data Sources ===
  sourcesModels: DbtModelResponse[];
  setSourcesModels: (models: DbtModelResponse[]) => void;

  // === Canvas State ===
  refreshTrigger: number;
  isCanvasLoading: boolean;
  triggerRefresh: () => void;
  setCanvasLoading: (loading: boolean) => void;

  // === Locking State ===
  lockUpperSection: boolean;
  tempLockCanvas: boolean;
  canvasLockStatus: CanvasLockStatus | null;
  isViewOnlyMode: boolean;
  setLockUpperSection: (lock: boolean) => void;
  setTempLockCanvas: (lock: boolean) => void;
  setCanvasLockStatus: (status: CanvasLockStatus | null) => void;
  setViewOnlyMode: (viewOnly: boolean) => void;

  // === UI Panels ===
  operationPanelOpen: boolean;
  selectedLowerTab: LowerSectionTab;
  lowerSectionHeight: number;
  openOperationPanel: () => void;
  closeOperationPanel: () => void;
  setSelectedLowerTab: (tab: LowerSectionTab) => void;
  setLowerSectionHeight: (height: number) => void;

  // === Modals ===
  publishModalOpen: boolean;
  patModalOpen: boolean;
  runWorkflowModalOpen: boolean;
  openPublishModal: () => void;
  closePublishModal: () => void;
  openPatModal: () => void;
  closePatModal: () => void;
  openRunWorkflowModal: () => void;
  closeRunWorkflowModal: () => void;

  // === Git Integration ===
  gitRepoUrl: string;
  patRequired: boolean;
  setGitRepoUrl: (url: string) => void;
  setPatRequired: (required: boolean) => void;

  // === Sync State ===
  isSyncingSources: boolean;
  setSyncingSources: (syncing: boolean) => void;

  // === Preview ===
  previewData: PreviewTableData | null;
  setPreviewData: (data: PreviewTableData | null) => void;

  // === Workflow Execution ===
  isWorkflowRunning: boolean;
  currentTaskId: string | null;
  setWorkflowRunning: (running: boolean) => void;
  setCurrentTaskId: (taskId: string | null) => void;

  // === DBT Run Logs ===
  dbtRunLogs: TaskProgressLog[];
  setDbtRunLogs: (logs: TaskProgressLog[]) => void;
  appendDbtRunLog: (log: TaskProgressLog) => void;
  clearDbtRunLogs: () => void;

  // === Preview Action ===
  previewAction: PreviewAction;
  setPreviewAction: (action: PreviewAction) => void;
  clearPreviewAction: () => void;

  // === Computed ===
  getFinalLockCanvas: () => boolean;
  canInteractWithCanvas: () => boolean;

  // === Reset ===
  reset: () => void;
}

const initialState = {
  activeTab: 'ui' as const,
  workspaceSetup: false,
  gitConnected: false,

  selectedNode: null as SelectedNodeData | null,
  canvasAction: { type: null, data: null } as CanvasAction,
  sourcesModels: [] as DbtModelResponse[],

  refreshTrigger: 0,
  isCanvasLoading: false,

  lockUpperSection: false,
  tempLockCanvas: false,
  canvasLockStatus: null as CanvasLockStatus | null,
  isViewOnlyMode: false,

  operationPanelOpen: false,
  selectedLowerTab: 'logs' as LowerSectionTab,
  lowerSectionHeight: 300,

  publishModalOpen: false,
  patModalOpen: false,
  runWorkflowModalOpen: false,

  gitRepoUrl: '',
  patRequired: false,

  isSyncingSources: false,

  previewData: null as PreviewTableData | null,

  isWorkflowRunning: false,
  currentTaskId: null as string | null,

  dbtRunLogs: [] as TaskProgressLog[],

  previewAction: { type: null, data: null } as PreviewAction,
};

export const useTransformStore = create<TransformState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setActiveTab: (tab) => set({ activeTab: tab }),
      setWorkspaceSetup: (setup) => set({ workspaceSetup: setup }),
      setGitConnected: (connected) => set({ gitConnected: connected }),

      // Node Selection
      setSelectedNode: (node) => set({ selectedNode: node }),
      clearSelectedNode: () => set({ selectedNode: null }),

      // Canvas Actions
      dispatchCanvasAction: (action) => set({ canvasAction: action }),
      clearCanvasAction: () => set({ canvasAction: { type: null, data: null } }),

      // Data Sources
      setSourcesModels: (models) => set({ sourcesModels: models }),

      // Canvas State
      triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
      setCanvasLoading: (loading) => set({ isCanvasLoading: loading }),

      // Locking
      setLockUpperSection: (lock) => set({ lockUpperSection: lock }),
      setTempLockCanvas: (lock) => set({ tempLockCanvas: lock }),
      setCanvasLockStatus: (status) => set({ canvasLockStatus: status }),
      setViewOnlyMode: (viewOnly) => set({ isViewOnlyMode: viewOnly }),

      // UI Panels
      openOperationPanel: () => set({ operationPanelOpen: true }),
      closeOperationPanel: () => set({ operationPanelOpen: false, selectedNode: null }),
      setSelectedLowerTab: (tab) => set({ selectedLowerTab: tab }),
      setLowerSectionHeight: (height) => set({ lowerSectionHeight: height }),

      // Modals
      openPublishModal: () => set({ publishModalOpen: true }),
      closePublishModal: () => set({ publishModalOpen: false }),
      openPatModal: () => set({ patModalOpen: true }),
      closePatModal: () => set({ patModalOpen: false }),
      openRunWorkflowModal: () => set({ runWorkflowModalOpen: true }),
      closeRunWorkflowModal: () => set({ runWorkflowModalOpen: false }),

      // Git Integration
      setGitRepoUrl: (url) => set({ gitRepoUrl: url }),
      setPatRequired: (required) => set({ patRequired: required }),

      // Sync
      setSyncingSources: (syncing) => set({ isSyncingSources: syncing }),

      // Preview
      setPreviewData: (data) => set({ previewData: data }),

      // Workflow
      setWorkflowRunning: (running) => set({ isWorkflowRunning: running }),
      setCurrentTaskId: (taskId) => set({ currentTaskId: taskId }),

      // DBT Run Logs
      setDbtRunLogs: (logs) => set({ dbtRunLogs: logs }),
      appendDbtRunLog: (log) => set((state) => ({ dbtRunLogs: [...state.dbtRunLogs, log] })),
      clearDbtRunLogs: () => set({ dbtRunLogs: [] }),

      // Preview Action
      setPreviewAction: (action) => set({ previewAction: action }),
      clearPreviewAction: () => set({ previewAction: { type: null, data: null } }),

      // Computed
      getFinalLockCanvas: () => {
        const state = get();
        return state.tempLockCanvas || state.lockUpperSection;
      },
      canInteractWithCanvas: () => {
        const state = get();
        const finalLock = state.tempLockCanvas || state.lockUpperSection;
        const isLockedByOther =
          state.canvasLockStatus?.is_locked === true &&
          !state.canvasLockStatus?.locked_by_current_user;
        const patBlocking = state.patRequired && state.isViewOnlyMode;
        return !finalLock && !state.isViewOnlyMode && !isLockedByOther && !patBlocking;
      },

      // Reset
      reset: () => set(initialState),
    }),
    { name: 'transform-store' }
  )
);

// Selector hooks for common state slices
export const useSelectedNode = () => useTransformStore((s) => s.selectedNode);
export const useOperationPanelOpen = () => useTransformStore((s) => s.operationPanelOpen);
export const useCanvasAction = () => useTransformStore((s) => s.canvasAction);
