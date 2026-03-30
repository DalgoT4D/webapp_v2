# Transform Page Migration Design: webapp → webapp_v2

> **Migration Approach**: Phased Migration with Feature Flags (Approach 2)
> **Timeline**: 5-8 weeks (Comprehensive)
> **Component Strategy**: Reuse Explore components (ProjectTree, PreviewPane, StatisticsPane)
> **Forms Strategy**: Full migration to React Hook Form + Radix UI
> **Date**: March 3, 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Component Structure](#component-structure)
4. [State Management](#state-management)
5. [Migration Phases](#migration-phases)
6. [Gap Analysis & Critical Findings](#gap-analysis--critical-findings)
7. [Special Features](#special-features)
8. [Modals & Dialogs](#modals--dialogs)
9. [API Integration](#api-integration)
10. [Component Features Reference](#component-features-reference)
11. [User Workflows](#user-workflows)
12. [Error Handling & Validation](#error-handling--validation)
13. [Testing Strategy](#testing-strategy)
14. [Risk Mitigation](#risk-mitigation)
15. [Success Criteria](#success-criteria)
16. [Appendix: Type Definitions](#appendix-type-definitions)

---

## Executive Summary

### Current State
The Transform page is currently embedded via iframe from the legacy webapp. It consists of:
- **59 TypeScript/TSX files** in TransformWorkflow
- **1,172 lines** in Canvas.tsx alone
- **19 operation form components** (Join, Pivot, Aggregate, CaseWhen, etc.)
- **2 main tabs**: UI Transform (visual workflow editor) + DBT Transform (task execution)
- Shared components with Explore (ProjectTree, PreviewPane, StatisticsPane)

### Migration Goals
1. **Full native migration** - eliminate iframe embedding
2. **Modern tech stack** - React Flow, React Hook Form, Zustand, SWR
3. **Component reuse** - leverage already-migrated Explore components
4. **Loose coupling** - operations are highly decoupled and maintainable
5. **Phased deployment** - incremental value delivery with 5 deployable milestones

### Technology Stack

| Category | Technology | Rationale |
|----------|-----------|-----------|
| **Canvas** | React Flow | Already in webapp_v2, mature library for node-based UIs |
| **Forms** | React Hook Form + Zod | Standard in webapp_v2, excellent validation |
| **State** | Zustand (4 separate stores) | Lightweight, avoids prop drilling, clear separation |
| **Data Fetching** | SWR hooks | Already used throughout webapp_v2 |
| **UI Components** | Radix UI + shadcn | Established pattern in webapp_v2 |
| **Tree View** | react-arborist | Already used in Explore migration |
| **Charts** | ECharts | Already used in dashboard and Explore |

### Key Architectural Decisions

1. **Multiple Zustand stores** instead of one monolithic store
   - `canvasStore` - Pure canvas state (nodes/edges)
   - `operationStore` - Operation configurations (decoupled!)
   - `workflowStore` - Workflow execution state
   - `transformStore` - Page-level state

2. **Reuse Explore components** with `included_in` prop
   - ProjectTree, PreviewPane, StatisticsPane already migrated
   - Support both 'explore' and 'transform' modes

3. **Operation forms are pure** - no direct store access
   - Each form is completely standalone
   - Communicate via props in/out
   - Easy to test and maintain

4. **Phased migration** - 5 deployable milestones over 5-8 weeks
   - Phase 1: Foundation & Tabs (Week 1-2) ✅ Deployable
   - Phase 2: Canvas Core (Week 3-4) ✅ Deployable
   - Phase 3: Priority Forms (Week 4-6) ✅ Deployable
   - Phase 4: Remaining Forms & Execution (Week 6-7) ✅ Deployable
   - Phase 5: Testing & Polish (Week 7-8) 🚀 Production

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ app/transform/page.tsx (App Router Entry)                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ components/transform/Transform.tsx (Main Container)             │
│  - Workspace setup & initialization                             │
│  - Tab management (UI Transform / DBT Transform)                │
│  - Feature flag integration                                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │                                       │
        ↓                                       ↓
┌──────────────────────┐          ┌──────────────────────────┐
│ UITransformTab       │          │ DBTTransformTab          │
│ (Visual Designer)    │          │ (Task Execution)         │
├──────────────────────┤          ├──────────────────────────┤
│ • DBTRepositoryCard  │          │ • DBTRepositoryCard      │
│ • WorkflowEditor     │          │ • DBTTaskList            │
│   ├─ ProjectTree     │          │ • LogCard                │
│   ├─ Canvas          │          └──────────────────────────┘
│   └─ LowerSection    │
│       ├─ PreviewPane │  (Reused from Explore)
│       ├─ LogsPane    │
│       └─ StatsPane   │  (Reused from Explore)
└──────────────────────┘
```

### Component Communication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ USER ACTIONS                                                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ CANVAS INTERACTION LAYER                                         │
│  • Drag node from ProjectTree                                    │
│  • Click node to select                                          │
│  • Connect edges                                                 │
│  • Delete node/edge                                              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ ZUSTAND STORE UPDATES (Pure State)                              │
│  canvasStore.addNode() ─────────────→ nodes array updated       │
│  canvasStore.setSelectedNodeId() ───→ selectedNodeId updated    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ REACT COMPONENT RE-RENDER                                        │
│  • Canvas re-renders with new nodes                              │
│  • OperationPanel opens with selectedNodeId                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ OPERATION FORM INTERACTION                                       │
│  • User fills form fields                                        │
│  • React Hook Form manages form state (ISOLATED)                │
│  • Zod validates on submit                                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ OPERATION CONFIG UPDATE (Separate Store!)                       │
│  operationStore.setOperationConfig(nodeId, config)               │
│  ⚠️ NO coupling between canvas and operation config             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ WORKFLOW EXECUTION (When "Run" clicked)                          │
│  1. workflowStore.serializeWorkflow()                            │
│     ├─ Reads canvasStore (nodes/edges)                          │
│     └─ Reads operationStore (configs)                           │
│  2. POST to API with serialized workflow                         │
│  3. Poll for task status (SWR)                                   │
│  4. Update workflowStore.lastRunStatus                           │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Component Reuse**: ProjectTree, PreviewPane, StatisticsPane from `components/explore` with `included_in="transform"` prop
2. **React Flow for Canvas**: Use React Flow library (already in package.json) instead of custom implementation
3. **Zustand for State**: Multiple stores for different concerns (canvas, operations, preview)
4. **SWR for Server State**: All API calls use SWR hooks with proper caching
5. **Context Providers**: Minimal - only for deeply nested Canvas components
6. **React Hook Form**: All 19 operation forms use consistent validation patterns

---

## Component Structure

### Directory Structure

```
components/
├── transform/
│   ├── Transform.tsx                      # Main container with workspace setup
│   ├── UITransformTab.tsx                # Visual designer tab
│   ├── DBTTransformTab.tsx               # Task execution tab
│   ├── DBTRepositoryCard.tsx             # Git connection UI
│   ├── DBTTaskList.tsx                   # Task execution & management
│   ├── LogCard.tsx                       # Logs display component
│   ├── WorkflowEditor/
│   │   ├── WorkflowEditor.tsx            # Main editor container
│   │   ├── Canvas/
│   │   │   ├── Canvas.tsx                # React Flow wrapper
│   │   │   ├── nodes/
│   │   │   │   ├── SourceModelNode.tsx   # Source/model node type
│   │   │   │   └── OperationNode.tsx     # Operation node type
│   │   │   ├── edges/
│   │   │   │   └── CustomEdge.tsx        # Custom edge styling
│   │   │   └── controls/
│   │   │       ├── CanvasToolbar.tsx     # Run, save, validate controls
│   │   │       └── MiniMap.tsx           # Optional minimap
│   │   ├── OperationPanel/
│   │   │   ├── OperationPanel.tsx        # Right panel container
│   │   │   ├── OperationSelector.tsx     # Operation type picker
│   │   │   └── forms/
│   │   │       ├── _base/
│   │   │       │   ├── BaseOperationForm.tsx      # Shared form wrapper
│   │   │       │   ├── FormField.tsx              # Reusable field component
│   │   │       │   ├── ColumnSelector.tsx         # Multi-column picker
│   │   │       │   └── validation.ts              # Zod schemas
│   │   │       ├── SelectColumnsForm.tsx          # Priority 1
│   │   │       ├── FilterForm.tsx                 # Priority 1
│   │   │       ├── JoinForm.tsx                   # Priority 1
│   │   │       ├── AggregateForm.tsx              # Priority 1
│   │   │       ├── CaseWhenForm.tsx               # Priority 1
│   │   │       ├── GroupByForm.tsx                # Priority 2
│   │   │       ├── PivotForm.tsx                  # Priority 2
│   │   │       ├── UnpivotForm.tsx                # Priority 2
│   │   │       ├── ArithmeticForm.tsx             # Priority 3
│   │   │       ├── CastColumnForm.tsx             # Priority 3
│   │   │       ├── CoalesceForm.tsx               # Priority 3
│   │   │       ├── DropColumnForm.tsx             # Priority 3
│   │   │       ├── FlattenJsonForm.tsx            # Priority 3
│   │   │       ├── RenameColumnForm.tsx           # Priority 3
│   │   │       ├── ReplaceValueForm.tsx           # Priority 3
│   │   │       ├── UnionTablesForm.tsx            # Priority 3
│   │   │       ├── GenericSqlForm.tsx             # Priority 3
│   │   │       ├── WhereFilterForm.tsx            # Priority 3
│   │   │       └── CreateTableForm.tsx            # Priority 3
│   │   ├── LowerSection/
│   │   │   ├── LowerSection.tsx          # Tabs container
│   │   │   ├── PreviewPane.tsx           # ⟳ Reused from explore
│   │   │   ├── LogsPane.tsx              # Build/run logs
│   │   │   └── StatisticsPane.tsx        # ⟳ Reused from explore
│   │   └── ProjectTree.tsx               # ⟳ Reused from explore
│   └── __tests__/
│       ├── transform-mock-data.ts
│       ├── Transform.test.tsx
│       └── ...

stores/
├── transformStore.ts                     # Transform page state
├── canvasStore.ts                        # Canvas nodes/edges state
├── operationStore.ts                     # Operation configs state
└── workflowStore.ts                      # Workflow execution state

hooks/api/
├── useTransform.ts                       # Transform API hooks
├── useDbtWorkspace.ts                    # DBT workspace hooks
└── usePrefectTasks.ts                    # Task execution hooks

types/
└── transform.ts                          # Transform-specific types

constants/
└── operations.ts                         # Operation type definitions

lib/
├── canvas-utils.ts                       # Canvas helper functions
└── workflow-serializer.ts                # Workflow save/load logic
```

### Shared Component Strategy

```typescript
// ProjectTree usage in Transform
import { ProjectTree } from '@/components/explore/ProjectTree';

<ProjectTree
  tables={sourcesModels}
  loading={loading}
  onSync={handleSync}
  onTableSelect={handleAddNodeToCanvas}  // Different handler!
  selectedTable={null}
  included_in="transform"  // ← Key prop for behavior switch
/>
```

### Component Interfaces

```typescript
// Main Transform component
interface TransformProps {
  // No props - reads from auth store
}

// UITransformTab
interface UITransformTabProps {
  onGitConnected: () => void;
  gitConnected: boolean;
}

// Canvas component
interface CanvasProps {
  redrawGraph: boolean;
  setRedrawGraph: (value: boolean) => void;
  finalLockCanvas: boolean;
  setTempLockCanvas: (value: boolean) => void;
}

// OperationPanel
interface OperationPanelProps {
  selectedNode: Node | null;
  onUpdateNode: (nodeId: string, config: OperationConfig) => void;
  onClose: () => void;
}

// Base operation form
interface BaseOperationFormProps<T> {
  initialValues?: T;
  onSubmit: (values: T) => void;
  onCancel: () => void;
  columns: Column[];  // Available columns from input
  disabled?: boolean;
}
```

---

## State Management

### Store Architecture - Separation of Concerns

We use **4 separate Zustand stores** instead of one monolithic store for clear separation:

#### 1. canvasStore.ts - Pure Canvas State

```typescript
interface CanvasState {
  // React Flow state
  nodes: Node[];
  edges: Edge[];

  // Pure setters
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  deleteNode: (nodeId: string) => void;

  // Selection
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // View state
  viewport: { x: number; y: number; zoom: number };
  setViewport: (viewport: Viewport) => void;

  // Reset
  reset: () => void;
}
```

**Responsibilities**: ONLY manages canvas visual state (positions, connections, selection). NO business logic.

#### 2. operationStore.ts - Operation Configuration

```typescript
interface OperationState {
  // Operation configs indexed by nodeId
  operations: Record<string, OperationConfig>;

  // CRUD operations
  setOperationConfig: (nodeId: string, config: OperationConfig) => void;
  getOperationConfig: (nodeId: string) => OperationConfig | null;
  deleteOperationConfig: (nodeId: string) => void;

  // Validation state
  validationErrors: Record<string, string[]>;
  setValidationErrors: (nodeId: string, errors: string[]) => void;

  // Reset
  reset: () => void;
}
```

**Responsibilities**: Stores operation configurations. Completely decoupled from canvas. `nodeId` is the only link.

#### 3. workflowStore.ts - Workflow Execution

```typescript
interface WorkflowState {
  // Execution state
  isRunning: boolean;
  isLocked: boolean;
  lastRunStatus: 'idle' | 'running' | 'success' | 'error';

  // Workflow metadata
  workflowName: string | null;
  lastSavedAt: Date | null;
  hasUnsavedChanges: boolean;

  // Actions
  setRunning: (running: boolean) => void;
  setLocked: (locked: boolean) => void;
  markSaved: () => void;
  markDirty: () => void;

  // Serialization
  serializeWorkflow: () => WorkflowPayload;
  loadWorkflow: (data: WorkflowPayload) => void;
}
```

**Responsibilities**: Workflow execution state, save/load, run status. Reads from other stores for serialization.

#### 4. transformStore.ts - Page-Level State

```typescript
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

  // Lower section state (for WorkflowEditor)
  lowerSectionTab: 'preview' | 'logs' | 'statistics';
  setLowerSectionTab: (tab: string) => void;
  lowerSectionHeight: number;
  setLowerSectionHeight: (height: number) => void;
}
```

**Responsibilities**: Top-level Transform page state. Tabs, workspace setup, UI state.

### Store Communication Rules

```typescript
// ✅ GOOD: Store reads from another store for serialization
function serializeWorkflow() {
  const canvasState = useCanvasStore.getState();
  const operationState = useOperationStore.getState();

  return {
    nodes: canvasState.nodes,
    operations: operationState.operations,
  };
}

// ❌ BAD: Store directly modifies another store
function addOperation(nodeId: string, config: OperationConfig) {
  useCanvasStore.getState().addNode({ id: nodeId });  // NO!
  // Instead, caller should handle both
}

// ✅ GOOD: Component orchestrates multiple stores
function handleAddOperation(type: OperationType) {
  const nodeId = generateId();
  canvasStore.addNode({ id: nodeId, type: 'operation', data: { label: type } });
  operationStore.setOperationConfig(nodeId, defaultConfig[type]);
}
```

### Forms Are Pure - No Store Access

```typescript
// ❌ BAD: Form directly accesses store
function JoinForm() {
  const { setOperationConfig } = useOperationStore(); // NO!

  const handleSubmit = (data) => {
    setOperationConfig(nodeId, data); // Tightly coupled!
  };
}

// ✅ GOOD: Form is pure, communicates via props
function JoinForm({ initialValues, onSubmit, onCancel, columns }: JoinFormProps) {
  const form = useForm({ defaultValues: initialValues });

  // Form manages its own state
  const handleSubmit = (data: JoinConfig) => {
    onSubmit(data);  // Parent decides what to do with it
  };

  return <FormProvider {...form}>...</FormProvider>;
}
```

### React Flow Adapter Pattern

```typescript
function Canvas() {
  const { nodes, edges, setNodes, setEdges, setSelectedNodeId } = useCanvasStore();

  // React Flow callbacks → Store actions
  const onNodesChange = useCallback((changes) => {
    setNodes(applyNodeChanges(changes, nodes));
  }, [nodes, setNodes]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onNodeClick={onNodeClick}
    />
  );
}
```

---

## Migration Phases

### Phase 1: Foundation & Tabs (Week 1-2)

**Goal**: Get the Transform page shell working with both tabs, DBT functionality, and workspace setup.

**Deliverables:**

```
✅ types/transform.ts                      // All type definitions
✅ stores/transformStore.ts                // Page-level state
✅ stores/canvasStore.ts                   // Canvas state (basic)
✅ stores/operationStore.ts                // Operation state (basic)
✅ stores/workflowStore.ts                 // Workflow state
✅ hooks/api/useTransform.ts               // Transform APIs
✅ hooks/api/useDbtWorkspace.ts            // DBT workspace APIs
✅ hooks/api/usePrefectTasks.ts            // Task execution APIs
✅ hooks/api/useTaskTemplates.ts           // Task templates & config APIs
✅ components/transform/Transform.tsx      // Main container
✅ components/transform/UITransformTab.tsx // Visual designer tab (shell)
✅ components/transform/DBTTransformTab.tsx // Task tab (full impl)
✅ components/transform/DBTRepositoryCard.tsx // Git connection UI
✅ components/transform/DBTTaskList.tsx    // Task list & execution
✅ components/transform/CreateTaskDialog.tsx // Custom task creation form
✅ components/transform/LogCard.tsx        // Logs display
✅ app/transform/page.tsx                  // Route (replace iframe)
```

**API Endpoints:**
- `GET /api/dbt/dbt_transform/` - Get transform type
- `POST /api/transform/dbt_project/` - Setup workspace
- `POST /api/transform/dbt_project/sync_sources/` - Sync sources
- `POST /api/prefect/tasks/transform/` - Create system tasks
- `GET /api/prefect/tasks/transform/` - Get tasks
- `POST /api/prefect/tasks/` - Create custom task
- `PUT /api/prefect/tasks/{taskUuid}/` - Update task config
- `GET /api/data/tasks/` - Get available task templates
- `GET /api/data/tasks/{taskSlug}/config/` - Get task flags/options
- `GET /api/dbt/dbt_workspace` - Get workspace info
- `POST /api/dbt/dbt_workspace` - Connect Git
- `PUT /api/dbt/dbt_workspace` - Update workspace
- `POST /api/prefect/v1/flows/{deploymentId}/run` - Run task
- `GET /api/tasks/{taskId}` - Poll task status

**Success Criteria:**
- [ ] Transform page loads without iframe
- [ ] Tabs switch between UI Transform and DBT Transform
- [ ] Git repository card connects/edits workspace
- [ ] DBT tasks list displays and executes
- [ ] Custom task creation works (create new tasks with flags/options)
- [ ] Task configuration editing works (modify existing tasks)
- [ ] Task execution logs display in real-time
- [ ] Workspace setup flow works (first-time user)
- [ ] Error states handled gracefully
- [ ] Transform type 'dbtcloud' supported alongside 'ui'/'github'

**Deployment**: ✅ Can deploy to production after 2 weeks

---

### Phase 2: Visual Designer Core (Week 3-4)

**Goal**: Get the Canvas working with basic node types, drag-and-drop, and ProjectTree integration.

**Deliverables:**

```
✅ components/transform/WorkflowEditor/WorkflowEditor.tsx
✅ components/transform/WorkflowEditor/Canvas/Canvas.tsx
✅ components/transform/WorkflowEditor/Canvas/nodes/SourceModelNode.tsx
✅ components/transform/WorkflowEditor/Canvas/nodes/OperationNode.tsx
✅ components/transform/WorkflowEditor/Canvas/edges/CustomEdge.tsx
✅ components/transform/WorkflowEditor/Canvas/controls/CanvasToolbar.tsx
✅ components/transform/WorkflowEditor/Canvas/CanvasLockBanner.tsx // Lock status UI
✅ components/transform/WorkflowEditor/LowerSection/LowerSection.tsx
✅ components/transform/WorkflowEditor/LowerSection/LogsPane.tsx
✅ components/transform/WorkflowEditor/OperationPanel/OperationPanel.tsx
✅ components/transform/WorkflowEditor/OperationPanel/OperationSelector.tsx
✅ components/transform/WorkflowPreview.tsx  // Preview saved workflow
✅ hooks/api/useCanvasLock.ts               // Canvas locking API
✅ constants/operations.ts                  // Operation type definitions
✅ lib/canvas-utils.ts                      // Canvas helper functions
✅ lib/workflow-serializer.ts               // Workflow save/load logic
```

**Canvas Features:**
- React Flow integration with custom node types
- Drag source/model from ProjectTree → adds node to canvas
- Click node → opens OperationPanel (empty for now)
- Connect nodes with edges
- Delete nodes/edges
- Canvas toolbar: Save, Run (disabled), Clear, Sync from Git
- Canvas locking mechanism (prevent concurrent edits)
- Lock status banner ("Locked by: user@email.com")
- Workflow preview component (show saved workflow before editing)
- Undo/Redo (optional, nice-to-have)

**React Flow Node Structure:**

```typescript
interface CanvasNode {
  id: string;
  type: 'source' | 'operation';
  position: { x: number; y: number };
  data: {
    label: string;
    schema?: string;       // For source nodes
    table?: string;        // For source nodes
    operationType?: string; // For operation nodes
    outputColumns?: string[]; // Computed columns available
    hasError?: boolean;
  };
}
```

**API Endpoints:**
- `GET /api/transform/v2/dbt_project/sources_models/` - Get sources/models
- `POST /api/transform/dbt_project/sync_sources/` - Sync sources
- `GET /api/transform/v2/dbt_project/canvas/` - Load saved workflow
- `POST /api/transform/v2/dbt_project/canvas/` - Save workflow
- `GET /api/transform/dbt_project/canvas/lock/` - Check canvas lock status
- `POST /api/transform/dbt_project/canvas/lock/` - Acquire canvas lock
- `DELETE /api/transform/dbt_project/canvas/lock/` - Release canvas lock
- `POST /api/transform/v2/dbt_project/sync_remote_dbtproject_to_canvas/` - Sync Git to canvas

**Success Criteria:**
- [ ] Canvas renders with React Flow
- [ ] Drag table from ProjectTree → adds source node
- [ ] Click "Add Operation" → adds operation node
- [ ] Connect nodes with edges
- [ ] Delete nodes/edges works
- [ ] Canvas state persists to Zustand
- [ ] Save workflow to backend (nodes/edges only)
- [ ] Load workflow from backend
- [ ] Canvas locking works (acquire/release/status)
- [ ] Lock banner shows "Locked by: user@email.com"
- [ ] Workflow preview displays saved workflow in collapsed state
- [ ] "Edit Workflow" button opens full canvas editor
- [ ] Sync from Git button updates canvas with remote changes
- [ ] PreviewPane shows selected table data (reused from Explore)
- [ ] StatisticsPane shows column stats (reused from Explore)
- [ ] LogsPane shows sync/save logs

**Deployment**: ✅ Can deploy after 4 weeks (users can build workflows, but can't configure operations yet)

---

### Phase 3: Priority Operation Forms (Week 4-6)

**Goal**: Implement the 8 most-used operation forms with full validation.

**Priority 1 Forms (Week 4-5):**

```
✅ components/transform/WorkflowEditor/OperationPanel/forms/_base/
   ✅ BaseOperationForm.tsx              // Shared wrapper
   ✅ FormField.tsx                      // Reusable field component
   ✅ ColumnSelector.tsx                 // Multi-column picker
   ✅ validation.ts                      // Shared Zod schemas

✅ SelectColumnsForm.tsx                 // Select/drop columns
✅ FilterForm.tsx                        // WHERE conditions
✅ JoinForm.tsx                          // JOIN operations
✅ AggregateForm.tsx                     // SUM, COUNT, AVG, etc.
✅ CaseWhenForm.tsx                      // CASE WHEN logic
```

**Priority 2 Forms (Week 5-6):**

```
✅ GroupByForm.tsx                       // GROUP BY
✅ PivotForm.tsx                         // Pivot transformation
✅ UnpivotForm.tsx                       // Unpivot transformation
```

**Form Pattern Template:**

```typescript
// Example: SelectColumnsForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BaseOperationForm } from './_base/BaseOperationForm';
import { ColumnSelector } from './_base/ColumnSelector';

const selectColumnsSchema = z.object({
  columns: z.array(z.string()).min(1, 'Select at least one column'),
  dropOthers: z.boolean().default(true),
});

type SelectColumnsConfig = z.infer<typeof selectColumnsSchema>;

interface SelectColumnsFormProps {
  initialValues?: SelectColumnsConfig;
  onSubmit: (values: SelectColumnsConfig) => void;
  onCancel: () => void;
  columns: string[]; // Available input columns
}

export function SelectColumnsForm({
  initialValues,
  onSubmit,
  onCancel,
  columns,
}: SelectColumnsFormProps) {
  const form = useForm<SelectColumnsConfig>({
    resolver: zodResolver(selectColumnsSchema),
    defaultValues: initialValues ?? { columns: [], dropOthers: true },
  });

  return (
    <BaseOperationForm
      title="Select Columns"
      onSubmit={form.handleSubmit(onSubmit)}
      onCancel={onCancel}
    >
      <ColumnSelector
        name="columns"
        label="Columns to Keep"
        options={columns}
        multiple
        control={form.control}
      />

      <Checkbox
        {...form.register('dropOthers')}
        label="Drop other columns"
      />
    </BaseOperationForm>
  );
}
```

**Operation Config Storage:**

```typescript
// operationStore holds configs indexed by nodeId
{
  'node-123': {
    type: 'select',
    config: {
      columns: ['id', 'name', 'email'],
      dropOthers: true,
    },
  },
  'node-456': {
    type: 'join',
    config: {
      joinType: 'left',
      leftOn: 'user_id',
      rightOn: 'id',
      rightTable: 'users',
    },
  },
}
```

**Success Criteria:**
- [ ] 8 operation forms implemented with validation
- [ ] Forms open when node selected
- [ ] Form validation works (Zod schemas)
- [ ] Form submission updates operationStore
- [ ] Node visual updates to show "configured" state
- [ ] Preview updates when operation configured (if possible)
- [ ] Error messages display clearly
- [ ] Form state persists when switching nodes

**Deployment**: ✅ Can deploy after 6 weeks (80% of use cases covered)

---

### Operation Forms Reference

This section provides complete specifications for all 17 transformation operations from the legacy webapp that need to be implemented.

#### 1. Select Columns (Priority 1)

**Purpose**: Choose specific columns to keep or drop from the dataset

**Form Fields**:
- `columns` (multi-select): Columns to keep
- `drop_others` (boolean): Whether to drop non-selected columns (default: true)

**Validation**:
- At least 1 column must be selected
- Selected columns must exist in input

**Output**: Dataset with only selected columns (if drop_others=true)

---

#### 2. Filter (WHERE) (Priority 1)

**Purpose**: Filter rows based on conditions

**Form Fields**:
- `conditions` (array of condition objects):
  - `column` (select): Column to filter on
  - `operator` (select): `=`, `!=`, `>`, `<`, `>=`, `<=`, `between`, `in`, `like`
  - `value` (input): Comparison value (or second value for `between`)
- `logic` (radio): `AND` / `OR` (how to combine multiple conditions)

**Validation**:
- At least 1 condition required
- Column must exist in input
- Value type must match column type

**Output**: Filtered dataset with fewer rows

---

#### 3. Join (Priority 1)

**Purpose**: Combine two datasets based on key columns

**Form Fields**:
- `join_type` (select): `left`, `right`, `inner`, `full outer`
- `right_table` (select): Second table to join (from sources)
- `left_on` (select): Key column from current dataset
- `right_on` (select): Key column from right table
- `column_mapping` (display): Visual mapping of columns

**Special Behavior**:
- Creates a "dummy node" for the second input during configuration
- Replaced with actual node on save

**Validation**:
- Both tables must be selected
- Join keys must exist in respective tables
- Join keys should have compatible types (warning, not error)

**Output**: Combined dataset with columns from both tables

---

#### 4. Aggregate (Priority 1)

**Purpose**: Perform aggregation functions on columns

**Form Fields**:
- `aggregations` (array):
  - `column` (select): Column to aggregate
  - `function` (select): `SUM`, `COUNT`, `AVG`, `MIN`, `MAX`, `COUNT_DISTINCT`
  - `alias` (input): Output column name (optional)
- `group_by` (multi-select): Columns to group by (optional)

**Validation**:
- At least 1 aggregation required
- Aggregated columns must exist
- COUNT can be used without column (COUNT(*))

**Output**: Aggregated dataset (1 row if no group_by, N rows if grouped)

---

#### 5. Case When (Priority 1)

**Purpose**: Conditional logic (IF-THEN-ELSE)

**Modes**:
- **Simple Mode**: Visual condition builder
- **Advanced Mode**: Raw SQL expression

**Form Fields (Simple Mode)**:
- `when_clauses` (array):
  - `condition`:
    - `column` (select): Column to evaluate
    - `operator` (select): `=`, `!=`, `>`, `<`, `>=`, `<=`, `between`
    - `operand_type` (radio): `Column` or `Value`
    - `operand_value` (input/select): Comparison column or value
  - `then_value` (input): Result when condition is true
- `else_value` (input): Default value when no conditions match
- `output_column` (input): Name for new column

**Form Fields (Advanced Mode)**:
- `sql_expression` (textarea): Raw CASE WHEN SQL

**Validation**:
- At least 1 WHEN clause required
- Output column name required
- SQL syntax validation in advanced mode

**Output**: Original columns + new computed column

---

#### 6. Group By (Priority 2)

**Purpose**: Group rows and apply aggregations

**Form Fields**:
- `group_by_columns` (multi-select): Columns to group by
- `aggregations` (array):
  - `column` (select): Column to aggregate
  - `function` (select): `SUM`, `COUNT`, `AVG`, `MIN`, `MAX`
  - `alias` (input): Output column name

**Validation**:
- At least 1 group_by column required
- At least 1 aggregation required

**Output**: Grouped dataset with aggregated columns

---

#### 7. Pivot (Priority 2)

**Purpose**: Transform rows to columns

**Form Fields**:
- `pivot_column` (select): Column whose unique values become new columns
- `value_column` (select): Column whose values fill the new columns
- `aggregation` (select): How to aggregate if multiple values (`SUM`, `AVG`, `COUNT`, etc.)
- `group_by` (multi-select): Columns to preserve (optional)

**Validation**:
- Pivot column and value column required
- Columns must exist in input

**Output**: Wider dataset with pivoted columns

---

#### 8. Unpivot (Priority 2)

**Purpose**: Transform columns to rows

**Form Fields**:
- `columns_to_unpivot` (multi-select): Columns to transform to rows
- `variable_column_name` (input): Name for column storing original column names (default: "variable")
- `value_column_name` (input): Name for column storing values (default: "value")

**Validation**:
- At least 1 column to unpivot required
- Column names must be valid SQL identifiers

**Output**: Longer dataset with unpivoted rows

---

#### 9. Arithmetic (Priority 3)

**Purpose**: Perform math operations on columns

**Form Fields**:
- `operation` (select): `+`, `-`, `*`, `/`, `%` (modulo)
- `left_operand`:
  - `type` (radio): `Column` or `Value`
  - `value` (select/input): Column or constant
- `right_operand`:
  - `type` (radio): `Column` or `Value`
  - `value` (select/input): Column or constant
- `output_column` (input): Name for result column

**Validation**:
- Both operands required
- Numeric type columns only
- Output column name required
- Division by zero warning

**Output**: Original columns + new computed column

---

#### 10. Cast Column (Priority 3)

**Purpose**: Change data types of columns

**Form Fields**:
- `columns_to_cast` (array):
  - `column` (select): Column to cast
  - `target_type` (select): `STRING`, `INTEGER`, `FLOAT`, `BOOLEAN`, `DATE`, `TIMESTAMP`

**Validation**:
- At least 1 column required
- Warns if casting may fail (e.g., string to number)

**Output**: Same columns with modified types

---

#### 11. Coalesce (Priority 3)

**Purpose**: Return first non-null value from multiple columns

**Form Fields**:
- `columns` (multi-select): Columns to evaluate (in order)
- `output_column` (input): Name for result column

**Validation**:
- At least 2 columns required
- Output column name required

**Output**: Original columns + new coalesced column

---

#### 12. Drop Columns (Priority 3)

**Purpose**: Remove columns from dataset

**Form Fields**:
- `columns_to_drop` (multi-select): Columns to remove

**Validation**:
- At least 1 column required
- Cannot drop all columns

**Output**: Dataset without dropped columns

---

#### 13. Flatten JSON (Priority 3)

**Purpose**: Extract fields from JSON column into separate columns

**Form Fields**:
- `json_column` (select): Column containing JSON data
- `json_preview` (display): Preview of JSON structure (first row)
- `fields_to_extract` (multi-select): JSON paths to extract
- `separator` (input): Separator for nested fields (default: "_")

**Special Behavior**:
- Fetches sample data to show JSON structure
- Dynamically discovers JSON fields

**Validation**:
- JSON column required
- At least 1 field required

**Output**: Original columns + new flattened columns

---

#### 14. Rename Columns (Priority 3)

**Purpose**: Change column names

**Form Fields**:
- `column_mappings` (array):
  - `old_name` (select): Current column name
  - `new_name` (input): New column name

**Validation**:
- At least 1 mapping required
- New names must be valid SQL identifiers
- New names must be unique

**Output**: Same data with renamed columns

---

#### 15. Replace Values (Priority 3)

**Purpose**: Find and replace values in a column

**Form Fields**:
- `column` (select): Column to modify
- `replacements` (array):
  - `find` (input): Value to find
  - `replace_with` (input): Replacement value
- `match_type` (select): `exact`, `contains`, `regex`

**Validation**:
- Column required
- At least 1 replacement required

**Output**: Modified column values

---

#### 16. Union Tables (Priority 3)

**Purpose**: Combine rows from multiple tables (UNION)

**Form Fields**:
- `tables_to_union` (multi-select): Tables to combine (from sources)
- `union_type` (select): `UNION` (distinct) or `UNION ALL` (keep duplicates)
- `column_mapping` (display): How columns will be aligned

**Special Behavior**:
- Creates dummy nodes for additional tables
- Cannot chain in middle (must be terminal or start of new chain)

**Validation**:
- At least 2 tables required
- Tables should have compatible schemas (warning if mismatched)

**Output**: Combined dataset with all rows

---

#### 17. Generic SQL (Priority 3)

**Purpose**: Write custom SQL transformation

**Form Fields**:
- `sql_query` (textarea): Raw SQL query
- `syntax_help` (display): SQL syntax reference

**Special Behavior**:
- **Cannot chain** - must create output table (terminal operation)
- Limited validation (basic SQL syntax check only)

**Validation**:
- SQL query required
- Basic syntax check (SELECT keyword, etc.)

**Output**: Result of custom SQL query

---

#### Common Form Features

All operation forms share these features:

1. **Create/Edit/View Modes**
   - Create: Empty form for new operation
   - Edit: Pre-filled with existing config
   - View: Read-only display

2. **Source Column Selection**
   - Autocomplete dropdowns
   - Shows column type hints
   - Validates column exists

3. **Output Column Naming**
   - Auto-generated suggestions
   - Validation for SQL identifier rules
   - Uniqueness check

4. **Validation**
   - Real-time validation (onChange)
   - Submit validation (full Zod schema)
   - Clear error messages

5. **Preview (Optional)**
   - Show sample output before saving
   - Uses warehouse preview API

6. **Continue Chain vs Create Table**
   - Continue: Add another operation
   - Create Table: Output to new table (terminal)

7. **Cancel/Reset**
   - Confirm discard if dirty
   - Reset to initial values

---

### Phase 4: Remaining Forms & Workflow Execution (Week 6-7)

**Goal**: Complete all 19 forms and implement workflow execution.

**Remaining 11 Forms:**

```
✅ ArithmeticForm.tsx                    // Math operations
✅ CastColumnForm.tsx                    // Type casting
✅ CoalesceForm.tsx                      // COALESCE
✅ DropColumnForm.tsx                    // Drop columns
✅ FlattenJsonForm.tsx                   // JSON flattening
✅ RenameColumnForm.tsx                  // Rename columns
✅ ReplaceValueForm.tsx                  // Value replacement
✅ UnionTablesForm.tsx                   // UNION
✅ GenericSqlForm.tsx                    // Raw SQL
✅ WhereFilterForm.tsx                   // Advanced filtering
✅ CreateTableForm.tsx                   // Create new table
```

**Workflow Execution Implementation:**

```typescript
// components/transform/WorkflowEditor/Canvas/controls/CanvasToolbar.tsx
function CanvasToolbar() {
  const { nodes, edges } = useCanvasStore();
  const { operations } = useOperationStore();
  const { setRunning } = useWorkflowStore();

  const handleRun = async () => {
    // Serialize workflow
    const workflow = serializeWorkflow(nodes, edges, operations);

    // Validate
    const errors = validateWorkflow(workflow);
    if (errors.length > 0) {
      toast.error('Workflow has validation errors');
      return;
    }

    // Execute
    setRunning(true);
    try {
      const response = await runWorkflow(workflow);

      // Poll for completion
      await pollTaskStatus(response.task_id);

      toast.success('Workflow completed successfully');
    } catch (error) {
      toast.error('Workflow execution failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Toolbar>
      <Button onClick={handleRun} disabled={nodes.length === 0}>
        Run Workflow
      </Button>
    </Toolbar>
  );
}
```

**API Endpoints:**
- `POST /api/dbt/run_dbt_via_celery/` - Run workflow
- `GET /api/tasks/{taskId}` - Poll execution status
- `POST /api/transform/v2/dbt_project/canvas/` - Save complete workflow

**Success Criteria:**
- [ ] All 19 operation forms implemented
- [ ] Run button executes workflow
- [ ] Workflow serialization includes all configs
- [ ] Task polling updates logs in real-time
- [ ] Success/failure states handled
- [ ] Workflow saves with all operation configs
- [ ] Workflow loads and restores all configs
- [ ] Canvas locks during execution

**Deployment**: ✅ Deploy after 7 weeks (Full feature parity)

---

### Phase 5: Testing, Polish & Documentation (Week 7-8)

**Goal**: Production-ready quality with comprehensive testing.

**Testing Deliverables:**

```
// Unit Tests
✅ stores/__tests__/canvasStore.test.ts
✅ stores/__tests__/operationStore.test.ts
✅ stores/__tests__/workflowStore.test.ts
✅ lib/__tests__/workflow-serializer.test.ts
✅ lib/__tests__/canvas-utils.test.ts

// Component Tests
✅ components/transform/__tests__/Transform.test.tsx
✅ components/transform/__tests__/UITransformTab.test.tsx
✅ components/transform/__tests__/DBTTransformTab.test.tsx
✅ components/transform/WorkflowEditor/__tests__/Canvas.test.tsx
✅ components/transform/WorkflowEditor/OperationPanel/__tests__/SelectColumnsForm.test.tsx
... (one test per form - 19 total)

// Integration Tests (Playwright)
✅ e2e/transform/workflow-creation.spec.ts
✅ e2e/transform/operation-forms.spec.ts
✅ e2e/transform/workflow-execution.spec.ts
✅ e2e/transform/git-integration.spec.ts
```

**Polish Items:**
- [ ] Keyboard shortcuts (Delete: Backspace, Save: Cmd+S)
- [ ] Loading skeletons for all async operations
- [ ] Empty states with helpful messages
- [ ] Error boundaries for graceful degradation
- [ ] Accessibility audit (ARIA labels, keyboard nav)
- [ ] Performance optimization (memoization, virtualization)
- [ ] Mobile responsiveness (basic support)
- [ ] Dark mode support (if applicable)

**Documentation:**

```
✅ docs/transform/ARCHITECTURE.md         // Architecture overview
✅ docs/transform/OPERATION_FORMS.md      // How to add new forms
✅ docs/transform/STATE_MANAGEMENT.md     // Store patterns
✅ docs/transform/TESTING.md              // Testing guidelines
✅ docs/plans/2026-03-03-transform-migration-design.md // This doc
```

**Success Criteria:**
- [ ] 80%+ test coverage
- [ ] All E2E flows passing
- [ ] No console errors/warnings
- [ ] Accessibility score >90
- [ ] Performance: Time to Interactive <3s
- [ ] Documentation complete
- [ ] Migration guide for users
- [ ] Rollback plan documented

**Final Deployment**: 🚀 Week 8 - Full production release

---

### Phase Timeline

```
Week 1  |████████| Foundation (Transform.tsx, Tabs, DBT)
Week 2  |████████| Foundation continued (API hooks, Stores)
        |--------|
Week 3  |████████| Canvas Core (React Flow, Nodes)
Week 4  |████████| Canvas + Priority Forms start
        |--------|
Week 5  |████████| Priority Forms (5 forms)
Week 6  |████████| Priority Forms + Remaining start
        |--------|
Week 7  |████████| Remaining Forms + Execution
Week 8  |████████| Testing & Polish
        |========| PRODUCTION READY
```

---

## Gap Analysis & Critical Findings

> **Date Analyzed**: March 3, 2026
> **Analyzer**: Deep codebase exploration of webapp v1 vs v2 migration plans
> **Coverage Assessment**: ~95% of functionality covered, 5% critical gaps identified
> **Risk Level**: MEDIUM-HIGH

### Executive Summary

After comprehensive analysis comparing the existing webapp v1 Transform functionality against the v2 migration plans, several **critical gaps** were identified that could impact production readiness. While the migration plans are thorough and well-structured, they miss important implementation details and some complete features.

**Bottom Line**: The migration is **feasible** but requires **supplemental tasks** for the identified gaps before production deployment.

---

### 🚨 P0 - CRITICAL MISSING FEATURES (Must Fix Before Launch)

#### 1. Select Columns Operation Form ❌ COMPLETELY MISSING

**Issue**: Listed as **Priority 1** operation in design document (lines 789-802) but **completely absent** from Phase 1 and Phase 3 implementation task lists.

**Impact**: HIGH - This is a fundamental operation for column selection/filtering.

**V1 State**: Functionality appears to be embedded within "Generic Column" operation in v1.

**V2 Plan**: Mentioned in design document but not included in any phase implementation.

**Required Action**:
```markdown
- [ ] Add SelectColumns form to Phase 3 Priority Forms list
- [ ] Create SelectColumnsOpForm.tsx component
- [ ] Add to operation type definitions
- [ ] Add to operation icon mapping
- [ ] Add validation rules for column selection
```

**Effort**: 1-2 days (similar complexity to DropColumn operation)

---

#### 2. Canvas Locking - Refresh Timer & View-Only Mode ⚠️ PARTIALLY COVERED

**Issue**: Lock mechanism conceptually covered in design doc (lines 1332-1412) but critical implementation details missing from Phase 1 task list.

**Missing Components**:
- ❌ 30-second heartbeat timer to maintain lock
- ❌ View-only mode UI when locked by another user
- ❌ "Locked by: user@email.com" banner component
- ❌ Emergency cleanup on browser close (beforeunload handler)
- ❌ Lock status polling for users in view-only mode

**Impact**: HIGH - Critical for multi-user scenarios. Without proper lock refresh, users will lose edit access mid-workflow.

**V1 Implementation Details**:
```typescript
// From Canvas.tsx (v1)
useEffect(() => {
  // Acquire lock on mount
  const acquireLock = async () => {
    const response = await httpPost(`/${sessionStorageOrgSlug()}/transform/dbt_project/canvas/lock/`);
    if (response.ok) {
      setHasLock(true);
    } else {
      const status = await response.json();
      setLockedBy(status.locked_by);
    }
  };

  acquireLock();

  // Refresh lock every 30 seconds
  const refreshInterval = setInterval(async () => {
    if (hasLock) {
      await httpPut(`/${sessionStorageOrgSlug()}/transform/dbt_project/canvas/lock/refresh/`);
    }
  }, 30000);

  // Cleanup on unmount
  return () => {
    clearInterval(refreshInterval);
    if (hasLock) {
      httpDelete(`/${sessionStorageOrgSlug()}/transform/dbt_project/canvas/lock/`);
    }
  };
}, [hasLock]);

// Emergency cleanup on browser close
window.addEventListener('beforeunload', () => {
  if (hasLock) {
    // Synchronous request required for beforeunload
    navigator.sendBeacon(`/${sessionStorageOrgSlug()}/transform/dbt_project/canvas/lock/`,
      JSON.stringify({ action: 'release' }));
  }
});
```

**Required Actions**:
```markdown
- [ ] Implement lock refresh timer in useCanvasLock hook
- [ ] Create LockedBanner component for view-only mode
- [ ] Add beforeunload handler for emergency cleanup
- [ ] Add lock status polling for viewers
- [ ] Test multi-tab scenarios
- [ ] Test browser crash scenarios
```

**Effort**: 2-3 days

---

#### 3. PAT (Personal Access Token) Modal Workflow ❌ NOT DOCUMENTED

**Issue**: V1 has a progressive disclosure pattern where users can **view canvas without authentication** but need **PAT to edit/publish**. This entire workflow is missing from migration plans.

**V1 Behavior**:
```typescript
// PatRequiredModal.tsx (v1)
// Shows when user clicks "Edit Workflow" without PAT
<Dialog>
  <DialogTitle>GitHub Personal Access Token Required</DialogTitle>
  <DialogContent>
    To edit and publish changes to your DBT workflow, you need to provide a GitHub Personal Access Token.

    <Link href="https://github.com/settings/tokens/new">Create a token</Link>

    <Input
      label="Personal Access Token"
      value={pat}
      onChange={setPat}
    />
  </DialogContent>
  <DialogActions>
    <Button onClick={savePat}>Save & Continue</Button>
    <Button variant="ghost" onClick={viewOnly}>View Only Mode</Button>
  </DialogActions>
</Dialog>
```

**User Flow**:
1. User navigates to Transform page → Canvas loads in **read-only preview**
2. User clicks "Edit Workflow" → PAT check
3. If PAT exists → Enter edit mode
4. If PAT missing → Show PatRequiredModal
5. User can:
   - Add PAT → Switch to edit mode
   - Choose "View Only" → Stay in preview mode

**Impact**: MEDIUM-HIGH - Affects UX and git integration workflow. Users need ability to explore before committing to git setup.

**Required Actions**:
```markdown
- [ ] Create PatRequiredModal component
- [ ] Add PAT check before entering edit mode
- [ ] Create "View Only Mode" banner for canvas
- [ ] Add PAT save/update functionality
- [ ] Add link to GitHub token creation
- [ ] Update UITransformTab to handle preview vs edit states
```

**Effort**: 2-3 days

---

#### 4. Canvas Preview Mode ❌ MISSING COMPONENT

**Issue**: V1 has dedicated `CanvasPreview.tsx` component for read-only preview. Migration mentions it but no implementation planned.

**V1 Implementation**:
```typescript
// CanvasPreview.tsx (v1)
export function CanvasPreview({ workflow }) {
  return (
    <div className="canvas-preview-container">
      <ReactFlow
        nodes={workflow.nodes}
        edges={workflow.edges}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={true}
        zoomOnScroll={true}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>

      <Button onClick={enterEditMode}>Edit Workflow</Button>
    </div>
  );
}
```

**Where Used**:
- UITransformTab main view (before clicking "Edit Workflow")
- Dashboard-style overview of workflow
- Allows zooming/panning but no editing

**Impact**: MEDIUM - Needed for dashboard-style view before entering edit mode.

**Required Actions**:
```markdown
- [ ] Create CanvasPreview.tsx component
- [ ] Add read-only ReactFlow configuration
- [ ] Add "Edit Workflow" button with PAT check
- [ ] Update UITransformTab to show preview by default
- [ ] Add smooth transition from preview to edit mode
```

**Effort**: 1-2 days

---

### ⚠️ P1 - HIGH PRIORITY GAPS (Should Fix Before Launch)

#### 5. Run Workflow Advanced Options ⚠️ PARTIALLY COVERED

**Issue**: V1 has **three run modes**, but migration only covers basic "Run workflow".

**V1 Run Options**:
```typescript
// Canvas.tsx header (v1)
<DropdownMenu>
  <DropdownMenuTrigger>
    <Button>Run Workflow</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={runFullWorkflow}>
      Run Full Workflow
    </DropdownMenuItem>
    <DropdownMenuItem
      onClick={runToNode}
      disabled={!selectedNode}
    >
      Run to Selected Node
    </DropdownMenuItem>
    <DropdownMenuItem
      onClick={runFromNode}
      disabled={!selectedNode}
    >
      Run from Selected Node
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

// Implementation
const runToNode = () => {
  const dbtSelect = `+${selectedNode.data.id}`;  // Run up to and including this node
  executeWorkflow({ select: dbtSelect });
};

const runFromNode = () => {
  const dbtSelect = `${selectedNode.data.id}+`;  // Run this node and downstream
  executeWorkflow({ select: dbtSelect });
};
```

**Impact**: MEDIUM - Power users rely on partial workflow execution for testing.

**Required Actions**:
```markdown
- [ ] Add run mode dropdown to Canvas header
- [ ] Implement --select flag configuration
- [ ] Add conditional enabling based on node selection
- [ ] Add UI indicators for selected run mode
- [ ] Update RunWorkflowModal to accept select parameter
- [ ] Test with DBT select syntax (+model, model+, @model)
```

**Effort**: 1-2 days

---

#### 6. Canvas Messages Component ⚠️ MISSING

**Issue**: In-canvas validation errors, warnings, and info messages component not documented.

**V1 Implementation**:
```typescript
// CanvasMessages.tsx (v1)
export function CanvasMessages({ messages }) {
  return (
    <div className="canvas-messages">
      {messages.map(msg => (
        <Alert
          key={msg.id}
          variant={msg.type} // 'error' | 'warning' | 'info'
        >
          <AlertIcon />
          <AlertTitle>{msg.title}</AlertTitle>
          <AlertDescription>{msg.description}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

// Example messages
[
  {
    type: 'error',
    title: 'Invalid Join Configuration',
    description: 'Join operation "join_customers" is missing the right table.'
  },
  {
    type: 'warning',
    title: 'Orphaned Node',
    description: 'Node "transform_data" is not connected to any source.'
  },
  {
    type: 'info',
    title: 'Workflow Saved',
    description: 'All changes have been saved successfully.'
  }
]
```

**Impact**: MEDIUM - Users need inline feedback for workflow validation errors.

**Required Actions**:
```markdown
- [ ] Create CanvasMessages component
- [ ] Add message state to canvasStore
- [ ] Integrate with workflow validation
- [ ] Add auto-dismiss for info messages
- [ ] Position above canvas (sticky header)
```

**Effort**: 1 day

---

#### 7. Context Providers → Zustand Migration Strategy ⚠️ NOT DOCUMENTED

**Issue**: V1 uses multiple React Context providers. Migration assumes Zustand replaces all but **no explicit migration guide**.

**V1 Context Providers**:
```typescript
// FlowEditor.tsx (v1)
<DbtRunLogsProvider>
  <CanvasNodeProvider>
    <CanvasActionProvider>
      <PreviewActionProvider>
        <Canvas />
      </PreviewActionProvider>
    </CanvasActionProvider>
  </CanvasNodeProvider>
</DbtRunLogsProvider>
```

**What Each Context Manages**:
- `DbtRunLogsProvider`: Task execution logs, polling state
- `CanvasNodeProvider`: Selected node, node validation state
- `CanvasActionProvider`: Canvas actions (add node, delete node, connect)
- `PreviewActionProvider`: Preview pane state, data loading

**V2 Zustand Store Mapping**:
```markdown
| V1 Context             | V2 Zustand Store   | Notes                           |
|------------------------|--------------------|---------------------------------|
| DbtRunLogsProvider     | workflowStore      | Execution + logs                |
| CanvasNodeProvider     | canvasStore        | Node selection + validation     |
| CanvasActionProvider   | canvasStore        | Actions as store methods        |
| PreviewActionProvider  | transformStore     | Page-level preview state        |
```

**Impact**: HIGH - Architectural decision with migration implications. Developers need clear guidance.

**Required Actions**:
```markdown
- [ ] Document Context → Zustand mapping in design doc
- [ ] Create migration examples for each context
- [ ] Explain action patterns in Zustand (methods vs events)
- [ ] Document state subscription patterns
- [ ] Add performance comparison notes
```

**Effort**: Documentation only, 0.5 days

---

#### 8. Dummy Nodes Implementation Details ⚠️ HIGH-LEVEL ONLY

**Issue**: Dummy nodes conceptually covered but missing implementation-level details.

**V1 Implementation**:
```typescript
// dummynodes.ts (v1)
export function generateDummyOperationNode(type: 'join' | 'union') {
  return {
    id: `dummy-${Date.now()}`,
    type: 'dummyNode',
    data: {
      operationType: type,
      label: type === 'join' ? 'Select table to join' : 'Select table to union',
      isDummy: true,
    },
    style: {
      border: '2px dashed #94a3b8',
      backgroundColor: '#f1f5f9',
      opacity: 0.7,
    },
  };
}

// Lifecycle
1. User adds Join/Union node → Dummy node created
2. User clicks dummy node → Table selection opens
3. User selects table → Dummy replaced with real source node
4. User cancels → Dummy removed
```

**Missing Details**:
- Visual styling (dashed border, gray background, reduced opacity)
- Form integration (how dummy triggers table selection)
- Cleanup edge cases (what if user saves with dummy nodes?)
- Validation (dummy nodes should block workflow execution)

**Impact**: MEDIUM - Complex feature with edge cases.

**Required Actions**:
```markdown
- [ ] Document dummy node visual styling
- [ ] Add dummy node cleanup on save validation
- [ ] Document table selection integration
- [ ] Add unit tests for dummy node lifecycle
- [ ] Document error handling for orphaned dummies
```

**Effort**: 1 day (mostly documentation, logic exists in design doc)

---

### 📋 P2 - MEDIUM PRIORITY (Can Launch Without, Fix Post-Launch)

#### 9. InfoBox Component

**Issue**: Contextual help component used in v1 forms not planned for v2.

**V1 Usage**:
```typescript
<InfoBox>
  <InfoIcon />
  <Text>
    Use CASE WHEN to create conditional logic. Similar to SQL CASE statements.
  </Text>
</InfoBox>
```

**Impact**: LOW-MEDIUM - Affects discoverability and user guidance.

**Alternative**: Can use Tooltip components from Radix UI instead.

**Decision Needed**: Migrate InfoBox or replace with Tooltips?

---

#### 10. Auto-Sync Sources - Error Handling

**Issue**: Auto-sync mentioned but error scenarios not documented.

**V1 Implementation**:
```typescript
// FlowEditor.tsx (v1)
const hasAutoSynced = useRef(false);

useEffect(() => {
  if (!hasAutoSynced.current && workspace) {
    syncSources()
      .then(() => {
        hasAutoSynced.current = true;
        toast.success('Sources synced');
      })
      .catch(err => {
        toast.error('Failed to sync sources. You can manually refresh.');
        // Continue loading editor anyway
      });
  }
}, [workspace]);
```

**Missing**:
- Error handling when sync fails
- User feedback during sync (loading state)
- Retry mechanism
- Manual sync button

**Impact**: MEDIUM - Affects initial load experience.

**Required Actions**:
```markdown
- [ ] Add error handling to auto-sync
- [ ] Add loading state during sync
- [ ] Add manual "Refresh Sources" button
- [ ] Add retry mechanism (max 3 attempts)
```

**Effort**: 0.5 days

---

#### 11. Generic Column vs Aggregate - Scope Overlap

**Issue**: V1's `GenericColumnOpForm` includes aggregate operations (avg, count, sum) which seems to overlap with separate `AggregateOpForm`.

**V1 Code**:
```typescript
// GenericColumnOpForm.tsx (v1)
const AggregateOperations = [
  'avg', 'count', 'countdistinct', 'max', 'min', 'sum'
];

// But there's also AggregateOpForm.tsx as a separate form
```

**Clarification Needed**:
- Are these two separate operations or one?
- Should Generic Column include aggregates?
- What's the difference in UX/functionality?

**Impact**: MEDIUM - Could lead to duplicate functionality or missing features.

**Required Actions**:
```markdown
- [ ] Review v1 usage patterns for both forms
- [ ] Clarify scope of Generic Column operation
- [ ] Update operation definitions document
- [ ] Ensure no duplicate/conflicting functionality
```

**Effort**: 0.5 days analysis

---

#### 12. Icon Assets Migration

**Issue**: Icons stored in v1 `/assets/icons/UI4T/` directory (18+ operation-specific icons) - not addressed in v2 plans.

**V1 Icon Mapping**:
```typescript
// constant.ts (v1)
export const operationIconMapping = {
  rename: '/assets/icons/UI4T/rename.svg',
  flatten: '/assets/icons/UI4T/flatten.svg',
  join: '/assets/icons/UI4T/join.svg',
  filter: '/assets/icons/UI4T/filter.svg',
  // ... 14 more
};
```

**Impact**: LOW - Visual consistency, easy to fix.

**Required Actions**:
```markdown
- [ ] Copy icons to v2 public/icons/ directory
- [ ] Update icon paths in operation definitions
- [ ] Consider using Lucide icons instead (already in v2)
```

**Effort**: 0.5 days

---

#### 13. Task Polling Hashkey Pattern

**Issue**: Task polling uses `hashkey` parameter for task isolation. Only partially documented.

**V1 Pattern**:
```typescript
// Different hashkeys for different task types
const hashkeys = {
  runWorkflow: `run-dbt-commands-${orgSlug}`,
  syncSources: `sync-sources-${orgSlug}`,
  testWorkflow: `test-dbt-${orgSlug}`,
  compileWorkflow: `compile-dbt-${orgSlug}`,
};

// Polling
pollTask(`/api/tasks/`, { hashkey: hashkeys.runWorkflow });
```

**Impact**: LOW-MEDIUM - Important for task isolation.

**Required Actions**:
```markdown
- [ ] Document complete hashkey naming convention
- [ ] Add to API integration section
- [ ] Create constant for hashkey patterns
```

**Effort**: 0.25 days (documentation only)

---

### 🔍 ADDITIONAL FINDINGS

#### Features Intentionally Not in Transform Scope (Document These)

1. **Discard Changes Button** - Commented out in v1 with note "Hidden for future release"
2. **DBT Docs Component** - Exists in v1 but separate from Transform page
3. **Elementary Integration** - Data quality tool, separate feature
4. **Embedded Mode** - V1 has `hideHeader` prop for iframe embedding

**Recommendation**: Create "Deferred Features" appendix listing items intentionally not migrated.

---

#### Missing Cross-Cutting Concerns

1. **Amplitude Tracking** - V1 has extensive `trackAmplitudeEvent` calls throughout. Not mentioned in v2.
2. **Feature Flags** - V1 uses `DATA_STATISTICS` flag. V2 mentions `TRANSFORM_NATIVE_MIGRATION` but not others.
3. **User Preferences Persistence** - Tab selection saving mentioned but implementation not detailed.
4. **Keyboard Shortcuts** - V1 has shortcuts (Ctrl+S to save, Delete to remove node). Not mentioned in v2.

---

### ✅ COMPREHENSIVE RECOMMENDATIONS

#### Phase 1 Additions (Critical Path)

```markdown
**Phase 1.5: Canvas Lock & Preview Mode** (Insert between Phase 1 and Phase 2)
Duration: 3-4 days
Blocking: Yes - Required for Phase 2 canvas work

Tasks:
- [ ] Implement lock refresh timer (30s heartbeat)
- [ ] Create LockedBanner component for view-only mode
- [ ] Add beforeunload handler for emergency cleanup
- [ ] Create CanvasPreview component
- [ ] Create PatRequiredModal component
- [ ] Add PAT check workflow
- [ ] Test multi-user lock scenarios
```

#### Phase 3 Updates

```markdown
**Add to Phase 3 Priority Forms:**
- [ ] SelectColumns operation form (Currently missing!)
- [ ] Clarify Generic Column vs Aggregate scope
```

#### Documentation Additions

```markdown
**Create New Sections:**
1. "Context to Zustand Migration Guide" (in Architecture section)
2. "Deferred Features" (in Appendix)
3. "Feature Flags Reference" (in API Integration)
4. "Analytics Tracking Strategy" (in Component Features)
5. "Keyboard Shortcuts" (in User Workflows)
```

#### Risk Mitigation Updates

**Add to Risk Table** (see updated Risk Mitigation section below)

#### Success Criteria Updates

**Update Phase 1 Success Criteria:**
- [ ] Lock refresh timer maintains lock for 30+ minutes
- [ ] View-only mode works when canvas locked by another user
- [ ] PAT modal workflow complete (view/edit modes)
- [ ] Canvas preview mode functional

**Update Phase 3 Success Criteria:**
- [ ] All 20 operation forms implemented (including SelectColumns!)
- [ ] Run-to-node and run-from-node options work
- [ ] No scope overlap between Generic Column and Aggregate

---

### 📊 UPDATED PRIORITY RANKINGS

#### P0 - Must Fix Before Launch (Blocking)
1. ✅ **SelectColumns operation form** - Add to Phase 3
2. ✅ **Canvas lock refresh timer** - Add to Phase 1.5
3. ✅ **PAT modal workflow** - Add to Phase 1.5
4. ✅ **Canvas preview mode** - Add to Phase 1.5

#### P1 - Should Fix Before Launch (High Value)
5. ⚠️ **Run workflow advanced options** - Add to Phase 4
6. ⚠️ **Canvas messages component** - Add to Phase 2
7. ⚠️ **Context to Zustand guide** - Documentation in Phase 1
8. ⚠️ **Dummy nodes details** - Add to design doc Phase 2

#### P2 - Can Launch Without (Post-Launch)
9. 📝 **InfoBox component** - Decide: migrate or use Tooltips
10. 📝 **Auto-sync error handling** - Add to Phase 1
11. 📝 **Icon migration** - Add to Phase 2
12. 📝 **Generic Column scope** - Clarify in Phase 3
13. 📝 **Hashkey documentation** - Add to API section

---

### 🎯 CONCLUSION

**Coverage Assessment**: ~95% → **Can achieve 100%** with supplemental tasks

**Timeline Impact**: +1 week (Phase 1.5 insertion)
- Original: 5-8 weeks
- Updated: 6-9 weeks

**Risk Level**: MEDIUM-HIGH → **REDUCED TO LOW** with gap fixes

**Go/No-Go Decision**:
- ❌ **NO-GO** without fixing P0 items (critical functionality missing)
- ✅ **GO** after addressing P0 items and Phase 1.5 insertion

**Next Steps**:
1. ✅ Review and approve this gap analysis
2. [ ] Update Phase 1 implementation plan to include Phase 1.5 tasks
3. [ ] Update Phase 3 to add SelectColumns form
4. [ ] Add documentation sections for Context→Zustand and Deferred Features
5. [ ] Update Risk Mitigation and Success Criteria sections (see below)
6. [ ] Proceed with implementation

---

## Special Features

### Canvas Locking Mechanism

**Purpose**: Prevent concurrent edits to the same workflow

**Implementation**:

```typescript
// hooks/api/useCanvasLock.ts
export function useCanvasLock() {
  const [hasLock, setHasLock] = useState(false);
  const [lockOwner, setLockOwner] = useState<string | null>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout>();

  // Acquire lock on mount
  useEffect(() => {
    const acquireLock = async () => {
      try {
        await apiPost('/api/transform/dbt_project/canvas/lock/');
        setHasLock(true);
        startRefreshTimer();
      } catch (error) {
        // Lock held by another user
        const status = await apiGet('/api/transform/dbt_project/canvas/lock/');
        setLockOwner(status.locked_by);
      }
    };

    acquireLock();

    return () => releaseLock();
  }, []);

  // Refresh lock every 30 seconds
  const startRefreshTimer = () => {
    refreshTimerRef.current = setInterval(async () => {
      try {
        await apiPut('/api/transform/dbt_project/canvas/lock/refresh/');
      } catch (error) {
        // Lost lock
        setHasLock(false);
      }
    }, 30000); // 30 seconds
  };

  // Release lock
  const releaseLock = async () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    try {
      await apiDelete('/api/transform/dbt_project/canvas/lock/');
    } catch (error) {
      // Already released or expired
    }
  };

  return { hasLock, lockOwner, releaseLock };
}
```

**Features**:
- Automatic lock acquisition on canvas open
- 30-second refresh timer to keep lock alive
- Auto-release on unmount, navigation, or browser close
- Lock status display: "Locked by: user@email.com"
- Disables all canvas interactions when locked by another user
- Emergency cleanup on window/tab close

**Lock Status Banner**:
```typescript
{lockOwner && (
  <Alert variant="warning">
    <Lock className="h-4 w-4" />
    <AlertDescription>
      Canvas is locked by {lockOwner}. You can view but not edit.
    </AlertDescription>
  </Alert>
)}
```

---

### Auto-Sync Sources on Open

**Purpose**: Ensure latest warehouse schema/tables are available

**Implementation**:
```typescript
const hasAutoSyncedRef = useRef(false);

useEffect(() => {
  if (!hasAutoSyncedRef.current && workspaceSetup) {
    syncSources();
    hasAutoSyncedRef.current = true;
  }
}, [workspaceSetup]);
```

**Behavior**:
- Runs once per session when opening workflow editor
- Fetches latest schemas/tables from data warehouse
- Updates ProjectTree with new sources
- Shows loading spinner during sync

---

### Dummy Nodes Pattern

**Purpose**: Temporary nodes during multi-input operation configuration (Join, Union)

**Implementation**:
```typescript
// When creating a Join operation
const handleAddJoin = () => {
  const mainNodeId = selectedNodeId;
  const dummyNodeId = `dummy-${Date.now()}`;

  // Add dummy node for second input
  canvasStore.addNode({
    id: dummyNodeId,
    type: 'source',
    position: { x: position.x - 200, y: position.y },
    data: { label: 'Select table...', isDummy: true },
  });

  // Open join form with dummy node reference
  operationStore.setOperationConfig(mainNodeId, {
    type: 'join',
    config: { secondInputNodeId: dummyNodeId },
  });
};

// On form submit
const handleJoinSubmit = (config: JoinConfig) => {
  // Replace dummy node with actual source node
  const actualNodeId = createSourceNode(config.rightTable);
  canvasStore.deleteNode(dummyNodeId);
  canvasStore.addNode(actualNode);

  // Save final config
  operationStore.setOperationConfig(mainNodeId, { type: 'join', config });
};

// On form cancel
const handleCancel = () => {
  // Clean up dummy node
  canvasStore.deleteNode(dummyNodeId);
};
```

**Behavior**:
- Dummy nodes created during form open
- Replaced with real nodes on save
- Auto-cleanup on cancel
- Visual indication (dashed border, gray color)

---

### Dagre Auto-Layout

**Purpose**: Automatic node positioning in left-to-right flow

**Implementation**:
```typescript
import dagre from 'dagre';

export function autoLayoutNodes(nodes: CanvasNode[], edges: CanvasEdge[]) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure layout direction and spacing
  dagreGraph.setGraph({
    rankdir: 'LR', // Left to right
    nodesep: 80,   // Horizontal spacing between nodes
    ranksep: 120,  // Vertical spacing between ranks
  });

  // Add nodes
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 180, height: 60 });
  });

  // Add edges
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Run layout
  dagre.layout(dagreGraph);

  // Apply positions to nodes
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 90, // Center node
        y: nodeWithPosition.y - 30,
      },
    };
  });
}
```

**Features**:
- Left-to-right flow (source → operations → output)
- Collision detection on manual drag
- Recalculate on new node added
- Smooth transitions between layouts

---

### Resizable Panels

**Implementation**:
```typescript
import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

<ResizablePanelGroup direction="horizontal">
  {/* ProjectTree Panel */}
  <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
    <ProjectTree />
  </ResizablePanel>

  {/* Canvas Panel */}
  <ResizablePanel defaultSize={60}>
    <Canvas />
  </ResizablePanel>

  {/* Operation Panel */}
  <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
    <OperationPanel />
  </ResizablePanel>
</ResizablePanelGroup>
```

**Panels**:
- **ProjectTree**: 280-550px width (left side)
- **Lower Section**: 200-800px height (bottom), drag-to-resize
- **Operation Panel**: Slides in from right (fixed 400px)

**Features**:
- Drag handles between panels
- Size persists in localStorage
- Collapse/expand buttons
- Full-screen toggle for lower section tabs

---

### Operation Chaining Rules

**Chainable Operations** (can add more operations after):
- Select Columns
- Filter
- Aggregate
- Case When
- Group By
- Arithmetic
- Cast
- Coalesce
- Drop
- Rename
- Replace

**Terminal Operations** (must create output table):
- Generic SQL (raw SQL)

**Conditionally Chainable** (depends on position):
- Join: Can be in middle, but second input must be source
- Union: Must be at end (cannot chain after)
- Pivot/Unpivot: Best at end, but can chain
- Flatten JSON: Best at end, but can chain

**UI Behavior**:
```typescript
// After operation form submit
<ButtonGroup>
  <Button onClick={() => createTable()}>
    Create Output Table
  </Button>

  {isChainable(operationType) && (
    <Button onClick={() => continueChain()}>
      Add Another Operation
    </Button>
  )}
</ButtonGroup>
```

---

## Modals & Dialogs

### Publish Modal

**Purpose**: Commit and push workflow changes to Git

**Trigger**: Click "Publish" button in canvas toolbar

**Layout**:
```typescript
<Dialog>
  <DialogHeader>
    <DialogTitle>Publish Changes to Git</DialogTitle>
    <DialogDescription>
      Commit and push your workflow changes to the GitHub repository
    </DialogDescription>
  </DialogHeader>

  {/* Git Status Display */}
  <div className="space-y-2">
    <h4>Changes to be committed:</h4>

    {/* Added Files */}
    {gitStatus.added.length > 0 && (
      <div>
        <p className="text-green-600">Added files:</p>
        {gitStatus.added.map(file => (
          <div key={file} className="flex items-center">
            <Plus className="h-3 w-3 mr-2" />
            <code>{file}</code>
          </div>
        ))}
      </div>
    )}

    {/* Modified Files */}
    {gitStatus.modified.length > 0 && (
      <div>
        <p className="text-yellow-600">Modified files:</p>
        {gitStatus.modified.map(file => (
          <div key={file} className="flex items-center">
            <Tilde className="h-3 w-3 mr-2" />
            <code>{file}</code>
          </div>
        ))}
      </div>
    )}

    {/* Deleted Files */}
    {gitStatus.deleted.length > 0 && (
      <div>
        <p className="text-red-600">Deleted files:</p>
        {gitStatus.deleted.map(file => (
          <div key={file} className="flex items-center">
            <Minus className="h-3 w-3 mr-2" />
            <code>{file}</code>
          </div>
        ))}
      </div>
    )}
  </div>

  {/* Commit Message Input */}
  <Textarea
    placeholder="Commit message (required)"
    value={commitMessage}
    onChange={(e) => setCommitMessage(e.target.value)}
    rows={3}
  />

  <DialogFooter>
    <Button variant="outline" onClick={onClose}>Cancel</Button>
    <Button
      onClick={handlePublish}
      disabled={!commitMessage.trim()}
    >
      {isPublishing ? 'Publishing...' : 'Publish'}
    </Button>
  </DialogFooter>
</Dialog>
```

**API Calls**:
1. `GET /api/dbt/git_status/` - Fetch uncommitted changes
2. `POST /api/dbt/publish_changes/` - Commit and push with message

**Validation**:
- Commit message is required (cannot be empty)
- Shows loading state during publish
- Success toast on completion
- Error toast with details on failure

---

### PAT Required Modal

**Purpose**: Prompt for Personal Access Token when Git repo connected but PAT missing

**Trigger**: Opens automatically when:
- Git repo URL exists in workspace
- No PAT stored
- User tries to publish or sync

**Layout**:
```typescript
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Personal Access Token Required</AlertDialogTitle>
      <AlertDialogDescription>
        Your GitHub repository is connected but requires a Personal Access Token
        to publish changes.
        <br /><br />
        <strong>Repository:</strong> {workspace.gitrepo_url}
      </AlertDialogDescription>
    </AlertDialogHeader>

    <div className="bg-yellow-50 p-3 rounded">
      <p className="text-sm">
        Required permissions: <code>repo</code>, <code>workflow</code>
      </p>
    </div>

    <AlertDialogFooter>
      <AlertDialogAction onClick={() => openPatForm()}>
        Add Personal Access Token
      </AlertDialogAction>
      <AlertDialogCancel onClick={() => setViewOnlyMode(true)}>
        View Only (Don't Publish)
      </AlertDialogCancel>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Behavior**:
- Two options: Add PAT or View Only
- "Add PAT" opens DBTRepositoryCard in edit mode
- "View Only" allows viewing but disables Publish/Sync buttons
- Modal blocks publish/sync actions until resolved

---

### Discard Changes Dialog

**Purpose**: Confirm before discarding unsaved operation form changes

**Trigger**: Click "Cancel" or "Back" from operation form when dirty

**Layout**:
```typescript
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
      <AlertDialogDescription>
        You have unsaved changes to this operation. Are you sure you want to discard them?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Continue Editing</AlertDialogCancel>
      <AlertDialogAction variant="destructive" onClick={handleDiscard}>
        Discard Changes
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Trigger Logic**:
```typescript
const isDirty = form.formState.isDirty;

const handleCancel = () => {
  if (isDirty) {
    setShowDiscardDialog(true);
  } else {
    onCancel();
  }
};
```

---

### Delete Task Confirmation

**Purpose**: Confirm before deleting a custom DBT task

**Trigger**: Click delete from task three-dot menu

**Layout**:
```typescript
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Task?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete the task "{task.label}".
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction variant="destructive" onClick={handleDelete}>
        {isDeleting ? 'Deleting...' : 'Delete Task'}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**API Call**: `DELETE /api/prefect/tasks/{taskId}/`

---

### Create/Edit Task Dialog

**Purpose**: Create new custom task or edit existing task configuration

**Trigger**:
- "Create New Task" button (create mode)
- Three-dot menu → "Edit" (edit mode)

**Layout**:
```typescript
<Dialog>
  <DialogHeader>
    <DialogTitle>{isEdit ? 'Edit Task' : 'Create Custom Task'}</DialogTitle>
  </DialogHeader>

  <Form {...form}>
    {/* Task Type Selector */}
    <Select {...form.register('taskType')}>
      <SelectTrigger>
        <SelectValue placeholder="Select task type" />
      </SelectTrigger>
      <SelectContent>
        {taskTemplates.map(template => (
          <SelectItem key={template.slug} value={template.slug}>
            {template.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

    {/* Task Label */}
    <Input
      {...form.register('label')}
      placeholder="Task name (e.g., 'Full Refresh Models')"
    />

    {/* Flags Multi-Select */}
    {taskConfig?.flags && (
      <div>
        <Label>Flags</Label>
        {taskConfig.flags.map(flag => (
          <Checkbox
            key={flag}
            {...form.register(`flags.${flag}`)}
            label={`--${flag}`}
          />
        ))}
      </div>
    )}

    {/* Options Key-Value Inputs */}
    {taskConfig?.options && (
      <div>
        <Label>Options</Label>
        {taskConfig.options.map(option => (
          <div key={option} className="flex gap-2">
            <Label className="w-32">--{option}</Label>
            <Input
              {...form.register(`options.${option}`)}
              placeholder={`Value for ${option}`}
            />
          </div>
        ))}
      </div>
    )}

    {/* Command Preview */}
    <Alert>
      <AlertDescription>
        <strong>Command:</strong>
        <code className="block mt-2">
          {generateCommandPreview(form.watch())}
        </code>
      </AlertDescription>
    </Alert>
  </Form>

  <DialogFooter>
    <Button variant="outline" onClick={onClose}>Cancel</Button>
    <Button onClick={form.handleSubmit(onSubmit)}>
      {isEdit ? 'Update Task' : 'Create Task'}
    </Button>
  </DialogFooter>
</Dialog>
```

**Dynamic Behavior**:
- Task type selection loads flags/options from API
- Flags shown as checkboxes
- Options shown as key-value inputs
- Live command preview updates as user types
- Excludes certain task types (TASK_GITPULL, TASK_DBTCLEAN, TASK_DOCSGENERATE)

**API Calls**:
- `GET /api/data/tasks/` - Get available task types
- `GET /api/data/tasks/{slug}/config/` - Get flags/options for selected type
- `POST /api/prefect/tasks/` - Create new task
- `PUT /api/prefect/tasks/{uuid}/` - Update existing task

---

## API Integration

### Complete API Endpoint Reference

This section lists all 40+ API endpoints used by the Transform page.

#### Workspace & Setup APIs

| Endpoint | Method | Purpose | Request Body | Response | Phase |
|----------|--------|---------|--------------|----------|-------|
| `/api/dbt/dbt_transform/` | GET | Get transform type for org | - | `{ transform_type: 'ui' \| 'github' \| 'dbtcloud' \| null }` | 1 |
| `/api/transform/dbt_project/` | POST | Create DBT project directory | `{ default_schema: string }` | `{ success: boolean }` | 1 |
| `/api/transform/dbt_project/dbtrepo` | DELETE | Cleanup on setup error | - | `{ success: boolean }` | 1 |
| `/api/prefect/tasks/transform/` | POST | Create system transform tasks | - | `{ tasks: TransformTask[] }` | 1 |
| `/api/transform/dbt_project/sync_sources/` | POST | Sync sources from warehouse | - | `{ synced: number }` | 1, 2 |
| `/api/transform/v2/dbt_project/sources_models/` | GET | Get all sources and models | - | `{ sources: DbtModel[], models: DbtModel[] }` | 2 |

#### DBT Workspace APIs

| Endpoint | Method | Purpose | Request Body | Response | Phase |
|----------|--------|---------|--------------|----------|-------|
| `/api/dbt/dbt_workspace` | GET | Get workspace info | - | `{ gitrepo_url: string, default_schema: string, ... }` | 1 |
| `/api/dbt/connect_git_remote/` | PUT | Connect/update Git repository | `{ gitrepoUrl: string, gitrepoAccessToken: string, defaultSchema: string }` | `{ success: boolean }` | 1 |
| `/api/dbt/v1/schema/` | PUT | Update default schema | `{ default_schema: string }` | `{ success: boolean }` | 1 |

#### Canvas Lock APIs

| Endpoint | Method | Purpose | Request Body | Response | Phase |
|----------|--------|---------|--------------|----------|-------|
| `/api/transform/dbt_project/canvas/lock/` | GET | Check canvas lock status | - | `{ locked: boolean, locked_by?: string }` | 2 |
| `/api/transform/dbt_project/canvas/lock/` | POST | Acquire canvas lock | - | `{ success: boolean }` | 2 |
| `/api/transform/dbt_project/canvas/lock/refresh/` | PUT | Refresh lock (30-sec timer) | - | `{ success: boolean }` | 2 |
| `/api/transform/dbt_project/canvas/lock/` | DELETE | Release canvas lock | - | `{ success: boolean }` | 2 |

#### Canvas Operations APIs

| Endpoint | Method | Purpose | Request Body | Response | Phase |
|----------|--------|---------|--------------|----------|-------|
| `/api/transform/v2/dbt_project/sync_remote_dbtproject_to_canvas/` | POST | Sync Git repo to canvas | - | `{ synced: boolean }` | 2 |
| `/api/transform/v2/dbt_project/graph/` | GET | Fetch workflow graph | - | `{ nodes: CanvasNode[], edges: CanvasEdge[] }` | 2 |
| `/api/transform/v2/dbt_project/models/{uuid}/nodes/` | POST | Add source to canvas | `{ position: { x, y } }` | `{ node_id: string }` | 2 |
| `/api/transform/v2/dbt_project/nodes/{id}/` | DELETE | Delete operation node | - | `{ success: boolean }` | 2 |
| `/api/transform/v2/dbt_project/model/{id}/` | DELETE | Delete source model | - | `{ success: boolean }` | 2 |

#### Operation Config APIs

| Endpoint | Method | Purpose | Request Body | Response | Phase |
|----------|--------|---------|--------------|----------|-------|
| `/api/transform/v2/dbt_project/nodes/{parent_id}/operations/` | POST | Create new operation | `{ type: OperationType, config: OperationConfig }` | `{ operation_id: string }` | 3, 4 |
| `/api/transform/v2/dbt_project/nodes/{id}/operations/` | PUT | Update operation config | `{ type: OperationType, config: OperationConfig }` | `{ success: boolean }` | 3, 4 |
| `/api/transform/v2/dbt_project/nodes/{id}/terminate_chain/` | POST | Create output table | `{ table_name: string, schema?: string }` | `{ success: boolean }` | 3, 4 |

#### Git Operations APIs

| Endpoint | Method | Purpose | Request Body | Response | Phase |
|----------|--------|---------|--------------|----------|-------|
| `/api/dbt/git_status/` | GET | Get uncommitted changes | - | `{ added: string[], modified: string[], deleted: string[] }` | 2, 4 |
| `/api/dbt/publish_changes/` | POST | Commit and push to Git | `{ commit_message: string }` | `{ success: boolean, commit_sha: string }` | 2, 4 |

#### Task Execution APIs

| Endpoint | Method | Purpose | Request Body | Response | Phase |
|----------|--------|---------|--------------|----------|-------|
| `/api/prefect/tasks/transform/` | GET | List transform tasks | - | `{ tasks: TransformTask[] }` | 1 |
| `/api/prefect/tasks/` | POST | Create custom org task | `{ task_type: string, label: string, flags: string[], options: Record<string,string> }` | `{ task_id: string }` | 1 |
| `/api/prefect/tasks/{uuid}/` | PUT | Update task config | `{ flags: string[], options: Record<string,string> }` | `{ success: boolean }` | 1 |
| `/api/prefect/tasks/{id}/` | DELETE | Delete org task | - | `{ success: boolean }` | 1 |
| `/api/prefect/tasks/{uuid}/run/` | POST | Execute task (non-deployment) | `{ vars?: Record<string,any> }` | `{ flow_run_id?: string, logs?: string[] }` | 1 |
| `/api/prefect/v1/flows/{deploymentId}/flow_run/` | POST | Execute task (with deployment) | `{ parameters?: Record<string,any> }` | `{ flow_run_id: string }` | 1 |
| `/api/prefect/flow_runs/{id}` | GET | Get flow run status | - | `{ status: string, start_time: string, end_time?: string }` | 1 |
| `/api/prefect/flow_runs/{id}/logs` | GET | Get flow run logs | - | `{ logs: LogEntry[] }` | 1 |
| `/api/dbt/run_dbt_via_celery/` | POST | Run DBT via Celery | `{ command: string, options?: Record<string,any> }` | `{ task_id: string }` | 1, 4 |
| `/api/tasks/{taskId}` | GET | Poll task status (general) | Query: `?hashkey=run-dbt-commands-{orgSlug}` | `{ status: string, progress: TaskProgress[] }` | 1, 4 |

#### Preview & Data APIs

| Endpoint | Method | Purpose | Request Body | Response | Phase |
|----------|--------|---------|--------------|----------|-------|
| `/api/warehouse/table_columns/{schema}/{table}` | GET | Get column specs | - | `{ columns: Column[] }` | 2 |
| `/api/warehouse/table_data/{schema}/{table}` | GET | Get paginated table data | Query: `?page=1&limit=100` | `{ data: Record[], total: number }` | 2 |
| `/api/warehouse/table_count/{schema}/{table}` | GET | Get total row count | - | `{ count: number }` | 2 |
| `/api/warehouse/download/{schema}/{table}` | GET | Download table as CSV | - | CSV file download | 2 |
| `/api/warehouse/v1/table_data/{schema}/{table}` | GET | Get table column details | - | `{ columns: ColumnDetail[] }` | 2 |
| `/api/warehouse/insights/metrics/` | POST | Generate column statistics | `{ schema: string, table: string }` | `{ task_id: string }` | 2 |
| `/api/tasks/{taskId}` | GET | Poll statistics generation | Query: `?hashkey=data-insights` | `{ status: string, results: ColumnStats[] }` | 2 |

#### User Preferences APIs

| Endpoint | Method | Purpose | Request Body | Response | Phase |
|----------|--------|---------|--------------|----------|-------|
| `/api/userpreferences/` | GET | Get user preferences | - | `{ preferences: Record<string, any> }` | 1 |
| `/api/userpreferences/` | PUT | Update preferences (save tab) | `{ key: 'transform_tab', value: 'ui' \| 'github' }` | `{ success: boolean }` | 1 |

#### Master Data APIs

| Endpoint | Method | Purpose | Request Body | Response | Phase |
|----------|--------|---------|--------------|----------|-------|
| `/api/data/tasks/` | GET | Get available task types | - | `{ tasks: TaskTemplate[] }` | 1 |
| `/api/data/tasks/{slug}/config/` | GET | Get task flags/options | - | `{ flags: string[], options: string[] }` | 1 |

---

## Component Features Reference

### ProjectTree Component

**Purpose**: Hierarchical tree view of data warehouse sources and DBT models

**Reused From**: `components/explore/ProjectTree.tsx` with `included_in="transform"` prop

**Structure**:
```
Data (root folder)
├── schema_1 (folder)
│   ├── table_1 (leaf node)
│   ├── table_2 (leaf node)
│   └── table_3 (leaf node)
├── schema_2 (folder)
│   └── table_4 (leaf node)
└── [more schemas...]
```

**Features**:

1. **Search Functionality**
   - Input field at top of tree
   - Filters by schema name OR table name
   - Auto-expands matching folders during search
   - Clears search resets tree to default state

2. **Node Actions** (per table):
   - **"Add to Canvas" button** (Plus icon)
     - Adds source node to workflow canvas
     - Position: auto-calculated by Dagre or click position
     - Only enabled when canvas is unlocked
   - **"Delete Source" button** (Trash icon)
     - Removes source from DBT project
     - Shows confirmation dialog
     - Requires `can_create_dbt_model` permission

3. **Sync Sources** (on "Data" folder):
   - Refresh icon button
   - Fetches latest schemas/tables from warehouse
   - Shows loading spinner during sync
   - Updates tree when complete
   - Requires `can_sync_sources` permission

4. **Visual Indicators**:
   - Folder icons (open/closed states)
   - Table icons for leaf nodes
   - Loading spinner during operations
   - Opacity reduction when permissions lacking

5. **Resizable**:
   - Drag handle on right edge
   - Min width: 280px
   - Max width: 550px
   - Persists size to localStorage

6. **Permission-Based Behavior**:
   - All buttons disabled if no `can_create_dbt_model`
   - Sync button hidden if no `can_sync_sources`
   - Visual feedback (opacity, cursor)

**API Calls**:
- `GET /api/transform/v2/dbt_project/sources_models/` - Load tree data
- `POST /api/transform/dbt_project/sync_sources/` - Sync with warehouse
- `DELETE /api/transform/v2/dbt_project/model/{id}/` - Delete source
- `POST /api/transform/v2/dbt_project/models/{uuid}/nodes/` - Add to canvas

**Props Interface**:
```typescript
interface ProjectTreeProps {
  tables: DbtModelResponse[];
  loading: boolean;
  onSync: () => void;
  onTableSelect: (table: DbtModelResponse) => void; // Different in Transform!
  selectedTable: DbtModelResponse | null;
  included_in: 'explore' | 'transform';
}
```

**Behavior Differences from Explore**:
- `onTableSelect` adds node to canvas (vs. loading preview in Explore)
- Sync button triggers source sync (vs. schema refresh in Explore)
- Delete button available (not in Explore)

---

### DBT Task List Component

**Purpose**: Display and execute DBT transformation tasks

**Location**: `components/transform/DBTTaskList.tsx`

**Features**:

1. **Task Display**:
   - Table with columns: Label, Last Run, Schedule, Actions
   - System tasks (dbt-run, dbt-test, dbt-docs-generate) + custom tasks
   - Three-dot menu for custom tasks (Edit, Delete)
   - Empty state: "No DBT tasks configured. Create a custom task to get started."

2. **Task Types**:
   - **System Tasks**: Auto-created, cannot be deleted
   - **Custom Tasks**: User-created with custom commands, can edit/delete

3. **Execute Button** (per task):
   - Primary action button
   - Shows loading spinner when running
   - Disabled when any task is running (lock)
   - Permission: `can_run_orgtask`

4. **Lock Indicators**:
   - When task running:
     - Shows "Triggered by: user@email.com"
     - Shows "Time since trigger: 2m 34s"
     - Disables execute button for ALL tasks
     - Shows lock icon
   - Auto-polling: Every 3-5 seconds when locked

5. **Status Icons**:
   - 🔄 Running (animated loop icon)
   - 🔒 Locked (lock icon)
   - 📅 Scheduled (schedule icon + cron expression)

6. **Auto-Polling**:
   ```typescript
   const { data: tasks, mutate } = useSWR(
     '/api/prefect/tasks/transform/',
     apiGet,
     {
       refreshInterval: (data) => {
         // Poll every 3 seconds if any task is locked
         const hasLocked = data?.tasks.some(t => t.lock);
         return hasLocked ? 3000 : 0;
       },
     }
   );
   ```

7. **Create New Task Button**:
   - Opens CreateTaskDialog
   - Shows at top of task list
   - Permission: `can_create_orgtask`

**Task Execution Flow**:

```typescript
const handleExecute = async (task: TransformTask) => {
  try {
    if (task.deploymentId) {
      // Has deployment - use Prefect flow run
      const { flow_run_id } = await runPrefectDeployment(task.deploymentId);
      pollFlowRunStatus(flow_run_id);
    } else {
      // No deployment - direct task run
      const { flow_run_id, logs } = await runPrefectTask(task.uuid);
      if (flow_run_id) {
        pollFlowRunStatus(flow_run_id);
      } else {
        // Logs returned immediately
        displayLogs(logs);
      }
    }
  } catch (error) {
    toast.error('Failed to execute task');
  }
};
```

**API Calls**:
- `GET /api/prefect/tasks/transform/` - Get tasks (with auto-polling)
- `POST /api/prefect/v1/flows/{deploymentId}/flow_run/` - Execute with deployment
- `POST /api/prefect/tasks/{uuid}/run/` - Execute without deployment
- `GET /api/prefect/flow_runs/{id}` - Poll flow run status
- `GET /api/prefect/flow_runs/{id}/logs` - Fetch logs
- `DELETE /api/prefect/tasks/{id}/` - Delete custom task

---

### LogCard Component

**Purpose**: Display real-time execution logs

**Location**: `components/transform/LogCard.tsx`

**Features**:

1. **Expandable/Collapsible**:
   - Accordion-style component
   - Auto-expands during task execution
   - Collapses when task completes
   - User can manually toggle

2. **Log Display**:
   - Monospace font (`font-mono`)
   - Each log on separate line
   - Timestamps (if available)
   - Log levels with colors:
     - INFO: Default text color
     - WARNING: Yellow
     - ERROR: Red

3. **Pagination**:
   - Default: Show first 100 logs
   - "Load More" button at bottom
   - Fetches next 100 logs (offset-based)
   - Infinite scroll (optional enhancement)

4. **Auto-Scroll**:
   - Scrolls to bottom when new logs arrive
   - Only if user is already at bottom
   - Respects manual scroll position

5. **Scrollable Area**:
   - Max height: 400px
   - Vertical scrollbar when overflow

**Implementation**:
```typescript
<Accordion type="single" collapsible value={isExpanded ? 'logs' : ''}>
  <AccordionItem value="logs">
    <AccordionTrigger onClick={toggleExpanded}>
      Logs {logs.length > 0 && `(${logs.length})`}
    </AccordionTrigger>
    <AccordionContent>
      <div className="max-h-[400px] overflow-y-auto font-mono text-sm">
        {logs.map((log, index) => (
          <div key={index} className={getLogLevelClass(log.level)}>
            {log.timestamp && <span className="text-gray-500 mr-2">{log.timestamp}</span>}
            {log.message}
          </div>
        ))}

        {hasMore && (
          <Button variant="ghost" onClick={loadMore}>
            Load More
          </Button>
        )}
      </div>
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

---

### Lower Section Tabs (Workflow Editor)

**Location**: `components/transform/WorkflowEditor/LowerSection/`

**Tabs**: Preview, Logs, Statistics

---

#### Preview Tab

**Purpose**: Display table data preview

**Reused From**: `components/explore/PreviewPane.tsx`

**Features**:

1. **Data Display**:
   - Table with all columns
   - Paginated rows (10, 25, 50, 100 per page)
   - Total row count display

2. **Column Sorting**:
   - Click column header to sort
   - Asc/desc toggle
   - Visual indicator (arrow icon)

3. **Pagination Controls**:
   - Page selector dropdown
   - Previous/Next buttons
   - Rows per page selector

4. **Download Button**:
   - Export current table as CSV
   - Downloads full table (not just current page)

5. **Header**:
   - Shows: `{schema}.{table}` (e.g., "staging.customers")
   - Row count: "1,234 rows"

**API Calls**:
- `GET /api/warehouse/table_columns/{schema}/{table}` - Column specs
- `GET /api/warehouse/table_data/{schema}/{table}?page={n}&limit={m}` - Data
- `GET /api/warehouse/table_count/{schema}/{table}` - Total count
- `GET /api/warehouse/download/{schema}/{table}` - CSV export

---

#### Logs Tab

**Purpose**: Display DBT run logs and build logs

**Component**: `components/transform/WorkflowEditor/LowerSection/LogsPane.tsx`

**Features**:

1. **Real-Time Streaming**:
   - Polls every 2-3 seconds during workflow run
   - Updates automatically as new logs arrive
   - Stops polling when run completes

2. **Log Levels** (color-coded):
   - **INFO**: White/default
   - **WARNING**: Yellow
   - **ERROR**: Red
   - **DEBUG**: Gray

3. **Timestamps**:
   - Each log entry has timestamp
   - Format: "HH:mm:ss" or "YYYY-MM-DD HH:mm:ss"

4. **Task Progress Tracking**:
   - Shows overall status: "Running...", "Completed", "Failed"
   - Progress indicators (if available)

5. **Auto-Scroll**:
   - Scrolls to latest log entry
   - Only if user is at bottom
   - Respects manual scroll position

6. **Expandable/Collapsible**:
   - Maximize to full height
   - Minimize to default

**Implementation**:
```typescript
const { data: taskStatus } = useSWR(
  taskId ? `/api/tasks/${taskId}?hashkey=run-dbt-commands` : null,
  apiGet,
  {
    refreshInterval: (data) => {
      const latest = data?.progress?.[data.progress.length - 1];
      if (['completed', 'failed'].includes(latest?.status)) {
        return 0; // Stop polling
      }
      return 2000; // Poll every 2 seconds
    },
  }
);
```

---

#### Statistics Tab

**Purpose**: Display column-level data insights

**Reused From**: `components/explore/StatisticsPane.tsx`

**Features**:

1. **Column Insights**:
   - Column name and data type
   - Distinct count
   - Null count
   - Null percentage

2. **Type-Specific Visualizations**:
   - **Numeric**: Min, max, mean, median, mode with histogram
   - **String**: Top 10 values with percentage breakdown (bar chart)
   - **Boolean**: True/false distribution (pie chart)
   - **Datetime**: Timeline chart with aggregation options (year/month/day)
   - **JSON**: "No data available" message

3. **Interactive Controls**:
   - Refresh button (regenerate statistics)
   - Datetime aggregation selector (year/month/day)

4. **Row and Column Counts**:
   - Total rows: 1,234
   - Total columns: 56

5. **Loading States**:
   - Skeleton loaders during computation
   - "Computing statistics..." message

**API Calls**:
- `GET /api/warehouse/v1/table_data/{schema}/{table}` - Table details
- `POST /api/warehouse/insights/metrics/` - Generate statistics (returns task_id)
- `GET /api/tasks/{taskId}?hashkey=data-insights` - Poll for results
- `GET /api/warehouse/table_count/{schema}/{table}` - Row count

**Feature Flag**: `DATA_STATISTICS` (can be disabled)

---

## User Workflows

### Workflow 1: First-Time Workspace Setup

**Trigger**: User navigates to Transform page for the first time

**Steps**:

1. **Auto-Setup Initiated**:
   - Shows loading screen: "Setting up your unified transform workspace..."
   - Spinner animation

2. **Backend Actions** (automatic):
   - `POST /api/transform/dbt_project/` - Creates local DBT project directory with default schema
   - `POST /api/prefect/tasks/transform/` - Creates system transform tasks (dbt-run, dbt-test, dbt-docs-generate)
   - `POST /api/transform/dbt_project/sync_sources/` - Syncs data sources from warehouse

3. **Success**:
   - Redirect to Transform page
   - Shows UI Transform and DBT Transform tabs
   - Tab preference saved to user preferences

4. **Error** (if setup fails):
   - Shows error message: "Workspace setup failed. Please try again."
   - "Retry" button appears
   - On retry:
     - `DELETE /api/transform/dbt_project/dbtrepo` - Cleanup partial setup
     - Restart from step 2

---

### Workflow 2: Connecting GitHub Repository

**Trigger**: User clicks "Connect Repository" or "Edit Repository" on DBTRepositoryCard

**Steps**:

1. **Open Form**:
   - Shows 3 fields:
     - GitHub Repository URL (input, validated URL pattern)
     - Personal Access Token (password input, masked)
     - Default Schema (input, e.g., "intermediate", "staging")
   - Shows warning: "PAT requires `repo` and `workflow` permissions"

2. **Validation**:
   - GitHub URL must be valid format: `https://github.com/{org}/{repo}`
   - PAT cannot be empty
   - Default schema must be valid SQL identifier

3. **Submit**:
   - `PUT /api/dbt/connect_git_remote/` with all 3 fields
   - Shows loading spinner in button: "Connecting..."

4. **Success**:
   - Toast: "GitHub repository connected successfully"
   - Form closes
   - Shows repository URL in card (read-only)

5. **Edit Mode** (existing connection):
   - Shows current repository URL
   - PAT field shows "●●●●●●●●" (masked)
   - Can update PAT or default schema
   - `PUT /api/dbt/dbt_workspace` to update

---

### Workflow 3: Creating a Visual Workflow

**Trigger**: User opens UI Transform tab and clicks "Edit Workflow"

**Steps**:

1. **Canvas Opens**:
   - Full-screen workflow editor
   - ProjectTree on left, Canvas in center, empty OperationPanel on right
   - Lower section with Preview/Logs/Statistics tabs

2. **Add Source to Canvas**:
   - User searches for table in ProjectTree
   - Clicks "+" icon next to table
   - Source node appears on canvas
   - Auto-positioned by Dagre

3. **Add Operation**:
   - Click source node to select
   - Click "Add Operation" button
   - Dummy operation node appears
   - OperationPanel opens on right
   - Shows operation type selector

4. **Configure Operation**:
   - Select operation type (e.g., "Filter")
   - Operation form loads with empty fields
   - Fill form:
     - Column: "status"
     - Operator: "="
     - Value: "active"
   - Click "Save"

5. **Operation Saved**:
   - Dummy node replaced with configured operation node
   - Node shows "configured" badge (green check)
   - OperationPanel shows "Continue Chain" and "Create Output Table" buttons

6. **Continue Chain** (add more operations):
   - Click "Continue Chain"
   - New dummy operation node appears
   - Repeat steps 4-5

7. **Create Output Table** (finish):
   - Click "Create Output Table"
   - Modal asks for table name: "active_users"
   - `POST /api/transform/v2/dbt_project/nodes/{id}/terminate_chain/`
   - Output node appears
   - Workflow complete

8. **Save Workflow**:
   - Click "Save" in toolbar
   - `POST /api/transform/v2/dbt_project/canvas/`
   - Toast: "Workflow saved successfully"

---

### Workflow 4: Executing a Workflow

**Trigger**: User clicks "Run" dropdown in canvas toolbar

**Options**:
- Run workflow (full run)
- Run to node (run up to selected node)
- Run from node (run from selected node onwards)

**Steps**:

1. **Select Run Option**:
   - User selects "Run workflow"

2. **Validation**:
   - Check all operation nodes are configured
   - If any unconfigured: Toast error: "Some operations are not configured"
   - Check workflow has output table
   - If no output: Toast error: "Workflow must end with an output table"

3. **Serialize Workflow**:
   - Collect all nodes, edges, and operation configs
   - Build WorkflowPayload

4. **Execute**:
   - `POST /api/dbt/run_dbt_via_celery/` with workflow
   - Returns task_id

5. **Poll Task Status**:
   - `GET /api/tasks/{taskId}?hashkey=run-dbt-commands`
   - Poll every 2 seconds
   - Update LogsPane with progress

6. **Display Logs**:
   - LogsPane auto-expands
   - Logs stream in real-time
   - Color-coded by level

7. **Completion**:
   - Status: "completed" or "failed"
   - If success: Toast: "Workflow executed successfully"
   - If failed: Toast: "Workflow execution failed. Check logs."
   - Logs remain visible

---

### Workflow 5: Creating a Custom DBT Task

**Trigger**: User clicks "Create New Task" button on DBT Transform tab

**Steps**:

1. **Open Dialog**:
   - CreateTaskDialog appears
   - Empty form

2. **Select Task Type**:
   - Dropdown with task types (from `GET /api/data/tasks/`)
   - User selects "dbt-run"
   - Form dynamically loads flags/options for dbt-run

3. **Fill Form**:
   - **Task Label**: "Full Refresh Models"
   - **Flags** (checkboxes):
     - ☑ `--full-refresh`
     - ☐ `--fail-fast`
   - **Options** (key-value):
     - `threads`: "4"
     - `models`: "staging.*"

4. **Live Command Preview**:
   - Shows: `dbt run --full-refresh --threads 4 --models staging.*`
   - Updates as user types

5. **Submit**:
   - Click "Create Task"
   - `POST /api/prefect/tasks/` with config
   - Loading spinner

6. **Success**:
   - Dialog closes
   - New task appears in task list
   - Toast: "Task created successfully"
   - Can now execute task

---

### Workflow 6: Publishing Changes to Git

**Trigger**: User clicks "Publish" button in canvas toolbar

**Steps**:

1. **Check Prerequisites**:
   - Git repository connected
   - PAT provided
   - If PAT missing: Show "PAT Required Modal"

2. **Fetch Git Status**:
   - `GET /api/dbt/git_status/`
   - Shows uncommitted changes in modal

3. **Publish Modal Opens**:
   - Lists added files (green, + prefix)
   - Lists modified files (yellow, ~ prefix)
   - Lists deleted files (red, - prefix)
   - Commit message textarea (required)

4. **User Enters Commit Message**:
   - E.g., "Add customer segmentation workflow"
   - Cannot be empty (button disabled)

5. **Submit**:
   - Click "Publish"
   - `POST /api/dbt/publish_changes/` with commit message
   - Shows "Publishing..." spinner

6. **Success**:
   - Toast: "Changes published to GitHub"
   - Modal closes
   - Workflow marked as "published" (no unpublished changes indicator)

7. **Error**:
   - Toast: "Failed to publish: {error message}"
   - Modal remains open
   - User can retry

---

## Error Handling & Validation

### Form Validations

All operation forms use **Zod schemas** for validation. Here's the comprehensive list:

#### 1. GitHub URL Validation

```typescript
const gitRepoSchema = z.object({
  gitrepoUrl: z.string()
    .url('Must be a valid URL')
    .regex(/^https:\/\/github\.com\/[\w-]+\/[\w-]+$/, 'Must be a GitHub repository URL'),
  gitrepoAccessToken: z.string().min(1, 'Personal Access Token is required'),
  defaultSchema: z.string()
    .min(1, 'Default schema is required')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Must be a valid SQL identifier'),
});
```

**Errors**:
- Invalid URL format
- Not a GitHub URL
- PAT empty
- Schema contains invalid characters

---

#### 2. Commit Message Validation

```typescript
const publishSchema = z.object({
  commitMessage: z.string()
    .min(1, 'Commit message cannot be empty')
    .max(500, 'Commit message too long (max 500 characters)'),
});
```

**Errors**:
- Empty commit message
- Exceeds 500 characters

---

#### 3. Operation Form Validations

**Select Columns**:
```typescript
z.object({
  columns: z.array(z.string()).min(1, 'Select at least one column'),
  dropOthers: z.boolean(),
})
```

**Filter**:
```typescript
z.object({
  conditions: z.array(z.object({
    column: z.string().min(1, 'Column required'),
    operator: z.enum(['=', '!=', '>', '<', '>=', '<=', 'between', 'in', 'like']),
    value: z.string().min(1, 'Value required'),
  })).min(1, 'At least one condition required'),
  logic: z.enum(['and', 'or']),
})
```

**Join**:
```typescript
z.object({
  joinType: z.enum(['left', 'right', 'inner', 'outer']),
  leftOn: z.string().min(1, 'Left key required'),
  rightOn: z.string().min(1, 'Right key required'),
  rightTable: z.string().min(1, 'Right table required'),
})
```

**Aggregate**:
```typescript
z.object({
  aggregations: z.array(z.object({
    column: z.string().min(1, 'Column required'),
    function: z.enum(['sum', 'count', 'avg', 'min', 'max', 'count_distinct']),
    alias: z.string().optional(),
  })).min(1, 'At least one aggregation required'),
  groupBy: z.array(z.string()).optional(),
})
```

**Case When**:
```typescript
z.object({
  cases: z.array(z.object({
    condition: z.string().min(1, 'Condition required'),
    value: z.string().min(1, 'Value required'),
  })).min(1, 'At least one WHEN clause required'),
  elseValue: z.string().optional(),
  outputColumn: z.string()
    .min(1, 'Output column name required')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid column name'),
})
```

**Generic SQL**:
```typescript
z.object({
  sqlQuery: z.string()
    .min(1, 'SQL query required')
    .regex(/\bSELECT\b/i, 'Query must contain SELECT statement'),
})
```

---

### API Error Handling

**Pattern for all API calls**:

```typescript
try {
  const response = await apiPost('/api/endpoint', data);
  toast.success('Operation successful');
} catch (error) {
  if (error instanceof Error) {
    toast.error(`Failed: ${error.message}`);
  } else {
    toast.error('An unexpected error occurred');
  }
  console.error('API Error:', error);
}
```

**Specific Error Cases**:

1. **Workspace Setup Failure**:
   - Show retry button
   - Clean up partial setup on retry
   - Log error details for debugging

2. **Git Connection Failure**:
   - Invalid credentials: "Invalid Personal Access Token"
   - Repository not found: "Repository not found. Check URL."
   - Network error: "Network error. Please try again."

3. **Task Execution Failure**:
   - Lock held by another user: "Task is currently running. Please wait."
   - Permission denied: "You don't have permission to run this task."
   - Execution error: Display error from logs

4. **Canvas Lock Conflicts**:
   - Lock held: Show banner "Locked by: user@email.com"
   - Disable all edit actions
   - Allow view-only access

5. **Save Workflow Failure**:
   - Validation errors: List all validation errors
   - Backend error: "Failed to save workflow. Please try again."
   - Network error: Auto-retry with exponential backoff

---

### Permission-Based Error Handling

**Pattern**:

```typescript
const { hasPermission } = useUserPermissions();

if (!hasPermission('can_run_orgtask')) {
  return (
    <Alert variant="warning">
      <AlertDescription>
        You don't have permission to execute tasks. Contact your administrator.
      </AlertDescription>
    </Alert>
  );
}
```

**Permissions Checked**:
- `can_create_dbt_workspace` - Create/edit workspace
- `can_edit_dbt_workspace` - Edit workspace settings
- `can_create_dbt_model` - Add sources to canvas
- `can_sync_sources` - Sync data sources
- `can_view_dbt_operation` - View operation configs
- `can_run_pipeline` - Execute workflows
- `can_run_orgtask` - Execute DBT tasks
- `can_create_orgtask` - Create custom tasks
- `can_delete_orgtask` - Delete tasks

---

### Validation Summary

| Validation Type | Where | Method | Error Handling |
|-----------------|-------|--------|----------------|
| Form fields | All forms | Zod schemas | Real-time + submit-time |
| API responses | All API calls | try/catch | Toast notifications |
| Permissions | All actions | Permission hooks | Disabled buttons + alerts |
| Git operations | Publish/Sync | API validation | Detailed error messages |
| Workflow structure | Before run | Custom validators | Pre-execution checks |
| SQL syntax | Generic SQL form | Basic regex | Warning (not blocking) |
| Column existence | All operation forms | Column list validation | Dropdown filtering |

---

### Transform Page APIs

| Endpoint | Method | Purpose | Phase |
|----------|--------|---------|-------|
| `/api/dbt/dbt_transform/` | GET | Get transform type | 1 |
| `/api/transform/dbt_project/` | POST | Setup workspace | 1 |
| `/api/transform/dbt_project/sync_sources/` | POST | Sync sources | 1, 2 |
| `/api/prefect/tasks/transform/` | POST | Create tasks | 1 |
| `/api/prefect/tasks/transform/` | GET | Get tasks | 1 |
| `/api/dbt/dbt_workspace` | GET | Get workspace info | 1 |
| `/api/dbt/dbt_workspace` | POST | Connect Git | 1 |
| `/api/dbt/dbt_workspace` | PUT | Update workspace | 1 |
| `/api/prefect/v1/flows/{deploymentId}/run` | POST | Run task | 1 |
| `/api/tasks/{taskId}` | GET | Poll task status | 1, 4 |
| `/api/transform/v2/dbt_project/sources_models/` | GET | Get sources/models | 2 |
| `/api/transform/v2/dbt_project/canvas/` | GET | Load workflow | 2 |
| `/api/transform/v2/dbt_project/canvas/` | POST | Save workflow | 2, 4 |
| `/api/dbt/run_dbt_via_celery/` | POST | Run workflow | 4 |

### SWR Hook Patterns

```typescript
// hooks/api/useTransform.ts

export function useTransformType() {
  return useSWR('/api/dbt/dbt_transform/', apiGet, {
    revalidateOnFocus: false,
  });
}

export function useDbtWorkspace() {
  return useSWR('/api/dbt/dbt_workspace', apiGet, {
    revalidateOnFocus: false,
  });
}

export function useSourcesModels() {
  return useSWR('/api/transform/v2/dbt_project/sources_models/', apiGet, {
    revalidateOnFocus: false,
  });
}

export function useWorkflow(workflowId?: string) {
  return useSWR(
    workflowId ? `/api/transform/v2/dbt_project/canvas/${workflowId}` : null,
    apiGet
  );
}

// Mutation helpers
export async function saveWorkflow(workflow: WorkflowPayload) {
  return apiPost('/api/transform/v2/dbt_project/canvas/', workflow);
}

export async function runWorkflow(workflow: WorkflowPayload) {
  return apiPost('/api/dbt/run_dbt_via_celery/', workflow);
}

// hooks/api/usePrefectTasks.ts

export function usePrefectTasks() {
  return useSWR('/api/prefect/tasks/transform/', apiGet, {
    refreshInterval: 5000, // Poll every 5 seconds if tasks are running
  });
}

export function useTaskStatus(taskId: string | null, hashkey: string = 'run-dbt-commands') {
  const url = taskId ? `/api/tasks/${taskId}?hashkey=${hashkey}` : null;

  return useSWR(url, apiGet, {
    refreshInterval: (data) => {
      if (!data) return 5000;
      const latest = data.progress?.[data.progress.length - 1];
      if (['completed', 'failed'].includes(latest?.status)) {
        return 0; // Stop polling
      }
      return 5000; // Continue polling
    },
  });
}
```

---

## Testing Strategy

### Test Coverage Goals

- **Unit Tests**: 80%+ coverage
- **Component Tests**: All major components
- **Integration Tests**: Critical user flows
- **E2E Tests**: Complete workflows

### Unit Tests

```typescript
// stores/__tests__/canvasStore.test.ts
describe('canvasStore', () => {
  it('adds a node', () => {
    const { addNode, nodes } = useCanvasStore.getState();
    addNode({ id: '1', type: 'source', position: { x: 0, y: 0 }, data: {} });
    expect(nodes).toHaveLength(1);
  });

  it('deletes a node', () => {
    const { addNode, deleteNode, nodes } = useCanvasStore.getState();
    addNode({ id: '1', type: 'source', position: { x: 0, y: 0 }, data: {} });
    deleteNode('1');
    expect(nodes).toHaveLength(0);
  });

  // ... more tests
});

// lib/__tests__/workflow-serializer.test.ts
describe('serializeWorkflow', () => {
  it('serializes nodes and edges', () => {
    const nodes = [{ id: '1', type: 'source', ... }];
    const edges = [{ id: 'e1', source: '1', target: '2' }];
    const operations = { '2': { type: 'select', config: { ... } } };

    const result = serializeWorkflow(nodes, edges, operations);

    expect(result).toMatchSnapshot();
  });
});
```

### Component Tests

```typescript
// components/transform/__tests__/Transform.test.tsx
import { render, screen } from '@testing-library/react';
import { Transform } from '../Transform';
import { TestWrapper } from '@/test-utils/render';

jest.mock('@/hooks/api/useTransform');

describe('Transform', () => {
  it('shows workspace setup on first load', () => {
    render(<Transform />, { wrapper: TestWrapper });
    expect(screen.getByText(/setting up workspace/i)).toBeInTheDocument();
  });

  it('shows tabs when workspace setup', () => {
    // Mock workspace setup complete
    render(<Transform />, { wrapper: TestWrapper });
    expect(screen.getByRole('tab', { name: /ui transform/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /dbt transform/i })).toBeInTheDocument();
  });
});

// Operation form tests
describe('SelectColumnsForm', () => {
  it('validates minimum column selection', async () => {
    const onSubmit = jest.fn();
    render(
      <SelectColumnsForm
        columns={['a', 'b', 'c']}
        onSubmit={onSubmit}
        onCancel={jest.fn()}
      />
    );

    // Try to submit without selecting columns
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText(/select at least one column/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

### E2E Tests (Playwright)

```typescript
// e2e/transform/workflow-creation.spec.ts
test('create and execute workflow', async ({ page }) => {
  await page.goto('/transform');

  // Wait for workspace setup
  await page.waitForSelector('[data-testid="ui-transform-tab"]');

  // Click to open workflow editor
  await page.click('[data-testid="edit-workflow-btn"]');

  // Drag a source from tree
  await page.dragAndDrop(
    '[data-testid="table-users"]',
    '[data-testid="canvas-container"]'
  );

  // Add an operation
  await page.click('[data-testid="add-operation-btn"]');
  await page.click('[data-testid="operation-select"]');

  // Configure operation
  await page.fill('[data-testid="column-selector"]', 'id, name');
  await page.click('[data-testid="submit-operation"]');

  // Run workflow
  await page.click('[data-testid="run-workflow-btn"]');

  // Wait for completion
  await page.waitForSelector('[data-testid="workflow-success"]');

  expect(await page.textContent('[data-testid="workflow-status"]')).toBe('Completed');
});
```

---

## Risk Mitigation

### Identified Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Missing SelectColumns form** | High | High | ✅ **IDENTIFIED IN GAP ANALYSIS** - Add to Phase 3 immediately |
| **Lock refresh timer issues** | High | Medium | ✅ **IDENTIFIED IN GAP ANALYSIS** - Implement in Phase 1.5, extensive multi-user testing |
| **PAT workflow confusion** | Medium | High | ✅ **IDENTIFIED IN GAP ANALYSIS** - Create Phase 1.5 with modal and preview mode |
| **Context to Zustand migration issues** | Medium | Medium | ✅ **IDENTIFIED IN GAP ANALYSIS** - Document mapping, create migration examples |
| **React Flow learning curve** | High | Medium | Use existing dashboard connection patterns, allocate 2-3 days for spike |
| **Operation form complexity** | High | High | Create template early (Phase 3 start), use as pattern for all 20 forms |
| **State synchronization issues** | Medium | Medium | Strict store separation rules, comprehensive unit tests |
| **Performance with large workflows** | Medium | Low | React Flow handles virtualization, test with 50+ nodes |
| **API compatibility changes** | Low | Low | Backend team confirmed stable API, create adapters if needed |
| **Workflow serialization bugs** | High | Medium | Extensive unit tests, validate against legacy format |
| **Missing edge cases in forms** | Medium | High | Review legacy form tests, port validation rules exactly |
| **Dummy node lifecycle bugs** | Medium | Medium | ✅ **IDENTIFIED IN GAP ANALYSIS** - Add implementation details, comprehensive unit tests |
| **Run-to-node/run-from-node missing** | Medium | High | ✅ **IDENTIFIED IN GAP ANALYSIS** - Add to Phase 4 with DBT select syntax |
| **Canvas messages not implemented** | Low | Medium | ✅ **IDENTIFIED IN GAP ANALYSIS** - Add to Phase 2 for validation feedback |

### Rollback Strategy

**Feature Flag**: `TRANSFORM_NATIVE_MIGRATION`

```typescript
// components/transform.tsx
import { useFeatureFlags } from '@/hooks/api/useFeatureFlags';

export default function Transform() {
  const { isFeatureFlagEnabled } = useFeatureFlags();

  if (isFeatureFlagEnabled('TRANSFORM_NATIVE_MIGRATION')) {
    // New native implementation
    return <TransformNative />;
  }

  // Fallback to iframe
  return <SharedIframe src={`${embeddedAppUrl}/pipeline/transform`} />;
}
```

**Rollback Plan:**
1. Monitor error rates in first 24 hours
2. If error rate >5%, disable feature flag
3. Users automatically revert to iframe
4. Fix issues, re-enable flag when stable

---

## Success Criteria

### Phase 1 Success Criteria
- [ ] Transform page loads without iframe
- [ ] Both tabs functional (UI Transform, DBT Transform)
- [ ] Git connection works end-to-end
- [ ] DBT tasks execute and logs display
- [ ] Workspace setup flow completes
- [ ] Zero regressions in DBT functionality
- [ ] ✅ **ADDED FROM GAP ANALYSIS**: Lock refresh timer maintains lock for 30+ minutes
- [ ] ✅ **ADDED FROM GAP ANALYSIS**: View-only mode works when canvas locked by another user
- [ ] ✅ **ADDED FROM GAP ANALYSIS**: PAT modal workflow complete (view/edit modes)
- [ ] ✅ **ADDED FROM GAP ANALYSIS**: Canvas preview mode functional
- [ ] ✅ **ADDED FROM GAP ANALYSIS**: Context→Zustand migration documented

### Phase 2 Success Criteria
- [ ] Canvas renders and performs smoothly
- [ ] Drag-drop from ProjectTree works
- [ ] Node connections work
- [ ] Save/load workflow works
- [ ] Preview and Statistics tabs functional (reused components)
- [ ] ✅ **ADDED FROM GAP ANALYSIS**: Canvas messages component displays validation errors
- [ ] ✅ **ADDED FROM GAP ANALYSIS**: Dummy nodes visual styling implemented
- [ ] ✅ **ADDED FROM GAP ANALYSIS**: Auto-sync error handling works

### Phase 3 Success Criteria
- [ ] 8 priority forms fully functional
- [ ] ✅ **UPDATED FROM GAP ANALYSIS**: All 20 operation forms implemented (including SelectColumns!)
- [ ] Form validation prevents invalid configs
- [ ] Operation configs persist correctly
- [ ] 80% of user workflows supported
- [ ] ✅ **ADDED FROM GAP ANALYSIS**: Generic Column vs Aggregate scope clarified
- [ ] ✅ **ADDED FROM GAP ANALYSIS**: Icon assets migrated or Lucide icons mapped

### Phase 4 Success Criteria
- [ ] ~~All 19 forms implemented~~ (Moved to Phase 3)
- [ ] Workflow execution works end-to-end
- [ ] Task polling and logs work
- [ ] 100% feature parity with legacy
- [ ] ✅ **ADDED FROM GAP ANALYSIS**: Run-to-node and run-from-node options work
- [ ] ✅ **ADDED FROM GAP ANALYSIS**: DBT select syntax (+model, model+, @model) validated
- [ ] ✅ **ADDED FROM GAP ANALYSIS**: Hashkey patterns documented and implemented

### Phase 5 Success Criteria
- [ ] 80%+ test coverage achieved
- [ ] All E2E tests passing
- [ ] No P0/P1 bugs
- [ ] Performance metrics met
- [ ] Documentation complete

### Production Success Metrics (30 days post-launch)
- [ ] <1% error rate
- [ ] <5% users request rollback
- [ ] Page load time <3s (p95)
- [ ] No data loss incidents
- [ ] Positive user feedback

---

## Appendix: Type Definitions

```typescript
// types/transform.ts

// ============================================
// WORKSPACE & SETUP
// ============================================

export type TransformType = 'github' | 'ui' | 'none' | 'dbtcloud' | null;

export interface DbtWorkspace {
  gitrepo_url: string;
  default_schema: string;
  target_type?: string;
  transform_type?: TransformType;
}

export interface DbtWorkspaceFormData {
  gitrepoUrl: string;
  gitrepoAccessToken: string;
  defaultSchema: string;
}

// ============================================
// CANVAS & NODES
// ============================================

export interface CanvasNode {
  id: string;
  type: 'source' | 'operation';
  position: { x: number; y: number };
  data: NodeData;
}

export interface NodeData {
  label: string;
  schema?: string;         // For source nodes
  table?: string;          // For source nodes
  operationType?: OperationType; // For operation nodes
  outputColumns?: string[];
  hasError?: boolean;
  isConfigured?: boolean;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
}

// ============================================
// OPERATIONS
// ============================================

export type OperationType =
  | 'select'
  | 'filter'
  | 'join'
  | 'aggregate'
  | 'casewhen'
  | 'groupby'
  | 'pivot'
  | 'unpivot'
  | 'arithmetic'
  | 'cast'
  | 'coalesce'
  | 'drop'
  | 'flatten_json'
  | 'rename'
  | 'replace'
  | 'union'
  | 'generic_sql'
  | 'where_filter'
  | 'create_table';

export interface OperationConfig {
  type: OperationType;
  config: Record<string, unknown>;
}

// Specific operation configs

export interface SelectColumnsConfig {
  columns: string[];
  dropOthers: boolean;
}

export interface FilterConfig {
  conditions: Array<{
    column: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'like';
    value: string | number;
  }>;
  logic: 'and' | 'or';
}

export interface JoinConfig {
  joinType: 'left' | 'right' | 'inner' | 'outer';
  leftOn: string;
  rightOn: string;
  rightTable: string;
  rightSchema?: string;
}

export interface AggregateConfig {
  aggregations: Array<{
    column: string;
    function: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'count_distinct';
    alias?: string;
  }>;
  groupBy?: string[];
}

export interface CaseWhenConfig {
  cases: Array<{
    condition: string;
    value: string;
  }>;
  elseValue?: string;
  outputColumn: string;
}

// ... (other operation configs)

// ============================================
// WORKFLOW
// ============================================

export interface WorkflowPayload {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  operations: Record<string, OperationConfig>;
  metadata: {
    name?: string;
    description?: string;
    version: string;
  };
}

export interface WorkflowExecutionRequest {
  workflow: WorkflowPayload;
  runOptions?: {
    fullRefresh?: boolean;
    threads?: number;
  };
}

// ============================================
// TASKS
// ============================================

export interface TransformTask {
  uuid: string;
  label: string;
  slug: string;
  type: string;
  deploymentId: string;
  deploymentName: string;
  cron?: string;
  lock?: {
    status: string;
    flowRunId: string;
    celeryTaskId: string;
  };
  lastRun?: {
    startTime: string;
    endTime?: string;
    status: string;
  };
}

export interface TaskProgress {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'error';
  message: string;
  timestamp: string;
  results?: unknown;
}

// ============================================
// SOURCES & MODELS
// ============================================

export interface DbtModelResponse {
  id: string;
  name: string;
  schema: string;
  type: 'source' | 'model';
  display_name: string;
  source_name: string;
  sql_path: string;
  output_cols: string[];
  uuid: string;
}

export interface Column {
  name: string;
  data_type: string;
  translated_type?: 'Numeric' | 'String' | 'Boolean' | 'Datetime' | 'Json';
}
```

---

## Appendix: Deferred Features

> **Note**: These features exist in v1 but are **intentionally not migrated** in the initial v2 release.

### 1. Discard Changes Button

**Status**: Commented out in v1 with note "Hidden for future release"

**V1 Implementation**:
```typescript
// Canvas.tsx (v1) - Lines 142-145 (commented out)
{/* <Button
  variant="ghost"
  onClick={handleDiscardChanges}
>
  Discard Changes
</Button> */}
```

**Decision**: Not migrating as it was disabled in v1. Can be added in future if needed.

**Effort if added later**: 0.5 days

---

### 2. DBT Docs Viewer

**Status**: Separate component from Transform page in v1

**V1 Location**: `webapp/src/components/DBT/DBTDocs.tsx`

**Decision**: This is a separate feature for viewing DBT documentation. Not part of Transform workflow. Will be migrated separately if needed.

**Effort if added later**: 2-3 days (iframe embedding or native viewer)

---

### 3. Elementary Integration

**Status**: Separate component for data quality testing in v1

**V1 Location**: `webapp/src/components/DBT/Elementary.tsx`

**Decision**: Elementary is a third-party data quality testing tool. Integration exists separately from Transform. Not in Transform migration scope.

**Effort if added later**: 3-4 days (depending on Elementary API changes)

---

### 4. Embedded/iframe Mode

**Status**: V1 has `hideHeader` prop for embedding Transform in iframes

**V1 Usage**:
```typescript
// Canvas.tsx (v1)
<TransformWorkflow hideHeader={isEmbedded} />
```

**Decision**: Not migrating initially. V2 Transform is native (no longer needs to be embedded). Can add embedding capability later if needed for integrations.

**Effort if added later**: 1-2 days (conditional header rendering + postMessage API)

---

### 5. UI4T (UI for Tests) - If Separate

**Status**: Icons exist in v1 (`/assets/icons/UI4T/`), but no dedicated UI for test creation found

**Investigation**: UI4T may refer to test-related operations in DBT Transform tab, not a separate UI

**Decision**: Monitor during implementation. If test UI is found in v1 and is separate from current plans, evaluate for Phase 5 or post-launch.

**Effort if needed**: TBD (depends on scope)

---

### 6. Advanced Keyboard Shortcuts

**Status**: V1 has basic shortcuts (Ctrl+S to save, Delete to remove node)

**V1 Implementation**: Not comprehensive, just basic browser defaults

**Decision**: Start with basic shortcuts. Can add advanced shortcuts (Ctrl+Z undo, Ctrl+C/V copy/paste nodes) in future enhancement.

**Effort if added later**: 2-3 days for full shortcut system

---

### 7. Amplitude Event Tracking (Non-Essential Events)

**Status**: V1 has extensive analytics tracking throughout

**Decision**: Migrate **essential** events (page views, workflow saves, task runs). Defer **nice-to-have** events (button hovers, form field interactions) to post-launch cleanup.

**Essential Events** (will be migrated):
- Page load
- Workflow save
- Workflow publish
- Task execution
- Operation add/edit/delete
- Node connection created

**Deferred Events** (can add later):
- Form field focus
- Tooltip hovers
- Tab switches
- Node selection
- Canvas zoom/pan

**Effort for deferred events**: 1-2 days (sprinkle throughout codebase)

---

### 8. Feature Flag: DATA_STATISTICS

**Status**: V1 uses this flag to show/hide data statistics panel

**V1 Usage**:
```typescript
if (featureFlags.DATA_STATISTICS) {
  <StatisticsPane />
}
```

**Decision**: V2 will show Statistics pane by default (already migrated from Explore). Can add feature flag later if org-level control needed.

**Effort if added later**: 0.5 days (wrap component with flag check)

---

### Summary

**Total Deferred Items**: 8 features/capabilities
**Total Effort if All Added Later**: ~15-20 days
**Recommendation**: Focus on core Transform migration. Add deferred features based on user feedback post-launch.

---

## Conclusion

This comprehensive design, **enhanced with gap analysis findings**, provides a clear roadmap for migrating the Transform page from iframe embedding to native implementation over **6-9 weeks** (updated from 5-8 weeks to include Phase 1.5).

### Key Strengths

1. **Incremental value delivery** with 5 deployable milestones (plus Phase 1.5 for critical gaps)
2. **Low risk** through feature flags and rollback capability
3. **High quality** with extensive testing and documentation
4. **Maintainability** through loose coupling and clean architecture
5. **Reusability** by leveraging already-migrated Explore components

### Gap Analysis Impact

**Coverage**: The migration plans cover **~95% of v1 functionality**. After addressing the identified gaps, coverage will be **100%**.

**Critical Additions** (from Gap Analysis section):
- ✅ Phase 1.5 inserted for canvas locking, preview mode, and PAT workflow
- ✅ SelectColumns form added to Phase 3
- ✅ Run-to-node/run-from-node added to Phase 4
- ✅ Canvas messages, auto-sync error handling, and other P1 items documented
- ✅ Context→Zustand migration guide added
- ✅ Deferred features explicitly documented in appendix

**Timeline Impact**: +1 week for Phase 1.5 critical features

**Risk Level**: Reduced from MEDIUM-HIGH to **LOW** after gap fixes

### Go/No-Go Decision

- ❌ **NO-GO** without fixing P0 items identified in gap analysis
- ✅ **GO** after addressing:
  1. Canvas lock refresh timer
  2. PAT modal workflow
  3. Canvas preview mode
  4. SelectColumns operation form

### Feature Parity

The migration will achieve **full feature parity** with the legacy implementation, with the following intentional deferrals (see Appendix: Deferred Features):
- Discard Changes button (already disabled in v1)
- DBT Docs viewer (separate feature)
- Elementary integration (separate feature)
- Embedded mode (not needed for native implementation)

---

**Updated Next Steps:**
1. ✅ Review and approve this design (including gap analysis)
2. [ ] **NEW**: Update Phase 1 implementation plan to include Phase 1.5 tasks
3. [ ] **NEW**: Update Phase 3 to add SelectColumns form
4. [ ] **NEW**: Add Context→Zustand migration documentation to Architecture section
5. [ ] Create detailed implementation plan (using `writing-plans` skill)
6. [ ] Set up project tracking (tasks, milestones, sprint planning)
7. [ ] Begin Phase 1 implementation

**Questions or concerns?** Please provide feedback before we proceed to implementation planning.
