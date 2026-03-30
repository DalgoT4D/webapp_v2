# Transform Canvas Component Specifications Overview

**Purpose**: This document catalogs all components to be migrated from webapp v1 to v2, with their complexity ratings and spec status.

**Approach**: Each component gets a detailed specification document before implementation to ensure 100% feature parity.

---

## Component Inventory

### Legend
- **Complexity**: `Low` (< 100 lines) | `Medium` (100-300 lines) | `High` (300+ lines)
- **Status**: `Pending` | `Specced` | `Implemented` | `Verified`
- **Priority**: `P0` (blocking) | `P1` (core feature) | `P2` (enhancement)

---

## 1. Foundation (Priority: P0)

| Component | v1 Location | Complexity | Lines | Status | Spec Doc |
|-----------|-------------|------------|-------|--------|----------|
| Types & Enums | `types/transform-v2.types.ts` | Medium | ~200 | Pending | [01-types-and-constants.md](./01-types-and-constants.md) |
| Operation Constants | `FlowEditor/constant.ts` | Low | ~155 | Pending | [01-types-and-constants.md](./01-types-and-constants.md) |
| Canvas Store | (new - based on contexts) | Medium | ~150 | Pending | [02-canvas-store.md](./02-canvas-store.md) |

---

## 2. API Hooks (Priority: P0)

| Hook | Endpoints | Complexity | Status | Spec Doc |
|------|-----------|------------|--------|----------|
| useCanvasGraph | 5 endpoints | Medium | Pending | [hooks/useCanvasGraph.md](./hooks/useCanvasGraph.md) |
| useCanvasOperations | 4 endpoints | Medium | Pending | [hooks/useCanvasOperations.md](./hooks/useCanvasOperations.md) |
| useCanvasLock | 3 endpoints | Medium | Pending | [hooks/useCanvasLock.md](./hooks/useCanvasLock.md) |
| useCanvasSources | 2 endpoints | Low | Pending | [hooks/useCanvasSources.md](./hooks/useCanvasSources.md) |
| useGitIntegration | 3 endpoints | Low | Pending | [hooks/useGitIntegration.md](./hooks/useGitIntegration.md) |
| useWorkflowExecution | 2 endpoints | Medium | Pending | [hooks/useWorkflowExecution.md](./hooks/useWorkflowExecution.md) |
| useColumnData | 3 endpoints | Low | Pending | [hooks/useColumnData.md](./hooks/useColumnData.md) |

---

## 3. Node Components (Priority: P0)

| Component | v1 Location | Complexity | Lines | Status | Spec Doc |
|-----------|-------------|------------|-------|--------|----------|
| DbtSourceModelNode | `Components/Nodes/DbtSourceModelNode.tsx` | High | ~250 | Pending | [nodes/DbtSourceModelNode.md](./nodes/DbtSourceModelNode.md) |
| OperationNode | `Components/Nodes/OperationNode.tsx` | Medium | ~150 | Pending | [nodes/OperationNode.md](./nodes/OperationNode.md) |

---

## 4. Canvas Components (Priority: P0)

| Component | v1 Location | Complexity | Lines | Status | Spec Doc |
|-----------|-------------|------------|-------|--------|----------|
| Canvas | `Components/Canvas.tsx` | **Very High** | ~950 | Pending | [canvas/Canvas.md](./canvas/Canvas.md) |
| CanvasPreview | `Components/CanvasPreview.tsx` | Low | ~80 | Pending | [canvas/CanvasPreview.md](./canvas/CanvasPreview.md) |
| CanvasMessages | `Components/CanvasMessages.tsx` | Low | ~65 | Pending | [canvas/CanvasMessages.md](./canvas/CanvasMessages.md) |
| CanvasToolbar | (extract from Canvas.tsx) | Medium | ~100 | Pending | [canvas/CanvasToolbar.md](./canvas/CanvasToolbar.md) |

---

## 5. Panel Components (Priority: P1)

| Component | v1 Location | Complexity | Lines | Status | Spec Doc |
|-----------|-------------|------------|-------|--------|----------|
| OperationConfigLayout | `Components/OperationConfigLayout.tsx` | **Very High** | ~600 | Pending | [panels/OperationConfigLayout.md](./panels/OperationConfigLayout.md) |
| CreateTableOrAddFunction | `Components/OperationPanel/CreateTableOrAddFunction.tsx` | Low | ~40 | Pending | [panels/CreateTableOrAddFunction.md](./panels/CreateTableOrAddFunction.md) |

---

## 6. Operation Forms (Priority: P1) - 18 Forms

### Simple Column Operations (4 forms)
| Form | v1 Location | Complexity | Lines | Status | Spec Doc |
|------|-------------|------------|-------|--------|----------|
| RenameColumnOpForm | `Forms/RenameColumnOpForm.tsx` | Medium | ~180 | Specced | [forms/RenameColumnOpForm.md](./forms/RenameColumnOpForm.md) |
| DropColumnOpForm | `Forms/DropColumnOpForm.tsx` | High | ~347 | Specced | [forms/DropColumnOpForm.md](./forms/DropColumnOpForm.md) |
| CastColumnOpForm | `Forms/CastColumnOpForm.tsx` | High | ~286 | Specced | [forms/CastColumnOpForm.md](./forms/CastColumnOpForm.md) |
| ReplaceValueOpForm | `Forms/ReplaceValueOpForm.tsx` | High | ~270 | Specced | [forms/ReplaceValueOpForm.md](./forms/ReplaceValueOpForm.md) |

### Aggregation Operations (3 forms)
| Form | v1 Location | Complexity | Lines | Status | Spec Doc |
|------|-------------|------------|-------|--------|----------|
| AggregationOpForm | `Forms/AggregationOpForm.tsx` | Medium | ~254 | Specced | [forms/AggregationOpForm.md](./forms/AggregationOpForm.md) |
| GroupByOpForm | `Forms/GroupByOpForm.tsx` | High | ~405 | Specced | [forms/GroupByOpForm.md](./forms/GroupByOpForm.md) |
| ArithmeticOpForm | `Forms/ArithmeticOpForm.tsx` | High | ~370 | Specced | [forms/ArithmeticOpForm.md](./forms/ArithmeticOpForm.md) |

### Multi-Table Operations (3 forms) - **Most Complex**
| Form | v1 Location | Complexity | Lines | Status | Spec Doc |
|------|-------------|------------|-------|--------|----------|
| JoinOpForm | `Forms/JoinOpForm.tsx` | **Very High** | ~530 | Specced | [forms/JoinOpForm.md](./forms/JoinOpForm.md) |
| UnionTablesOpForm | `Forms/UnionTablesOpForm.tsx` | **Very High** | ~389 | Specced | [forms/UnionTablesOpForm.md](./forms/UnionTablesOpForm.md) |
| CoalesceOpForm | `Forms/CoalesceOpForm.tsx` | High | ~331 | Specced | [forms/CoalesceOpForm.md](./forms/CoalesceOpForm.md) |

### Conditional Operations (2 forms)
| Form | v1 Location | Complexity | Lines | Status | Spec Doc |
|------|-------------|------------|-------|--------|----------|
| CaseWhenOpForm | `Forms/CaseWhenOpForm.tsx` | **Very High** | ~822 | Specced | [forms/CaseWhenOpForm.md](./forms/CaseWhenOpForm.md) |
| WhereFilterOpForm | `Forms/WhereFilterOpForm.tsx` | High | ~403 | Specced | [forms/WhereFilterOpForm.md](./forms/WhereFilterOpForm.md) |

### Transform Operations (4 forms)
| Form | v1 Location | Complexity | Lines | Status | Spec Doc |
|------|-------------|------------|-------|--------|----------|
| PivotOpForm | `Forms/PivotOpForm.tsx` | High | ~442 | Specced | [forms/PivotOpForm.md](./forms/PivotOpForm.md) |
| UnpivotOpForm | `Forms/UnpivotOpForm.tsx` | High | ~456 | Specced | [forms/UnpivotOpForm.md](./forms/UnpivotOpForm.md) |
| FlattenJsonOpForm | `Forms/FlattenJsonOpForm.tsx` | High | ~299 | Specced | [forms/FlattenJsonOpForm.md](./forms/FlattenJsonOpForm.md) |
| CreateTableForm | `Forms/CreateTableForm.tsx` | Medium | ~198 | Specced | [forms/CreateTableForm.md](./forms/CreateTableForm.md) |

### Generic Operations (2 forms)
| Form | v1 Location | Complexity | Lines | Status | Spec Doc |
|------|-------------|------------|-------|--------|----------|
| GenericColumnOpForm | `Forms/GenericColumnOpForm.tsx` | High | ~374 | Specced | [forms/GenericColumnOpForm.md](./forms/GenericColumnOpForm.md) |
| GenericSqlOpForm | `Forms/GenericSqlOpForm.tsx` | Medium | ~198 | Specced | [forms/GenericSqlOpForm.md](./forms/GenericSqlOpForm.md) |

---

## 7. Modal Components (Priority: P1)

| Component | v1 Location | Complexity | Lines | Status | Spec Doc |
|-----------|-------------|------------|-------|--------|----------|
| PublishModal | `Components/PublishModal.tsx` | Medium | ~285 | Specced | [modals/PublishModal.md](./modals/PublishModal.md) |
| PatRequiredModal | `Components/PatRequiredModal.tsx` | Low | ~144 | Specced | [modals/PatRequiredModal.md](./modals/PatRequiredModal.md) |
| DiscardChangesDialog | (inline in OperationConfigLayout) | Low | ~20 | Specced | [modals/DiscardChangesDialog.md](./modals/DiscardChangesDialog.md) |

---

## 8. Layout Components (Priority: P0)

| Component | v1 Location | Complexity | Lines | Status | Spec Doc |
|-----------|-------------|------------|-------|--------|----------|
| FlowEditor | `FlowEditor/FlowEditor.tsx` | High | ~429 | Specced | [layout/FlowEditor.md](./layout/FlowEditor.md) |
| ProjectTree | `Components/ProjectTree.tsx` | Medium | ~405 | Specced | [layout/ProjectTree.md](./layout/ProjectTree.md) |
| LogsPane | `LowerSectionTabs/LogsPane.tsx` | Low | ~121 | Specced | [layout/LowerSectionTabs.md](./layout/LowerSectionTabs.md) |
| PreviewPane | `LowerSectionTabs/PreviewPane.tsx` | Medium | ~305 | Specced | [layout/LowerSectionTabs.md](./layout/LowerSectionTabs.md) |
| StatisticsPane | `LowerSectionTabs/StatisticsPane.tsx` | High | ~588 | Specced | [layout/LowerSectionTabs.md](./layout/LowerSectionTabs.md) |

---

## 9. Shared/Reused Components

These components already exist in webapp_v2 explore feature and will be reused:

| Component | Location | Changes Needed |
|-----------|----------|----------------|
| PreviewPane | `components/explore/PreviewPane.tsx` | None |
| StatisticsPane | `components/explore/StatisticsPane.tsx` | None |
| ProjectTree | `components/explore/ProjectTree.tsx` | Add `mode` prop, "+" button |

---

## Spec Document Template

Each spec document follows this structure:

```markdown
# [Component Name] Specification

## Overview
- Purpose
- Screenshot reference
- v1 file location

## Props/Interface
| Prop | Type | Required | Default | Description |

## State Variables
| State | Type | Initial | Purpose |

## API Endpoints Used
| Endpoint | Method | When Called | Response Type |

## API Payload Structure (for forms)
```json
{
  // exact structure
}
```

## Form Fields (for forms)
| Field | Type | Required | Default | Validation | Options Source |

## useEffect Dependencies
| Effect | Dependencies | Action |

## Event Handlers
| Handler | Trigger | Action |

## UI Layout
- Component hierarchy
- Styling details
- Responsive behavior

## Edge Cases
- Error states
- Loading states
- Empty states

## Implementation Checklist
- [ ] All props implemented
- [ ] All state variables
- [ ] All API calls
- [ ] All form fields
- [ ] All validations
- [ ] All edge cases
- [ ] Tests written
```

---

## Implementation Order

### Phase 1: Foundation (no UI)
1. `01-types-and-constants.md` → implement types
2. `02-canvas-store.md` → implement store
3. All hooks specs → implement hooks

### Phase 2: Core Visual
4. `nodes/DbtSourceModelNode.md` → implement
5. `nodes/OperationNode.md` → implement
6. `canvas/Canvas.md` → implement

### Phase 3: Operation Forms (largest effort)
7. Start with simple forms (Rename, Drop)
8. Then aggregation forms
9. Then complex multi-table forms (Join, Union)
10. Then conditional forms (CaseWhen, Where)

### Phase 4: Integration
11. `panels/OperationConfigLayout.md` → implement
12. `FlowEditor.md` → implement
13. Modals

### Phase 5: Polish
14. Edge cases
15. Testing
16. Review

---

## Progress Tracking

| Phase | Total Components | Specced | Implemented | Verified |
|-------|------------------|---------|-------------|----------|
| Foundation | 3 | 3 | 0 | 0 |
| Hooks | 7 | 7 | 0 | 0 |
| Nodes | 2 | 2 | 0 | 0 |
| Canvas | 4 | 4 | 0 | 0 |
| Panels | 2 | 2 | 0 | 0 |
| Forms | 18 | 18 | 0 | 0 |
| Modals | 3 | 3 | 0 | 0 |
| Layout | 5 | 5 | 0 | 0 |
| Utilities | 1 | 1 | 0 | 0 |
| **Total** | **45** | **45** | **0** | **0** |

**Gap Analysis**: A comprehensive audit was performed and all gaps have been addressed. See [GAP-ANALYSIS.md](./GAP-ANALYSIS.md) for details.

### All Specs Completed ✓

#### Foundation
- [x] `01-types-and-constants.md` - All types, enums, and constants
- [x] `02-canvas-store.md` - Zustand store design

#### Hooks
- [x] `hooks/useCanvasGraph.md` - Graph data fetching
- [x] `hooks/useCanvasOperations.md` - Node CRUD operations
- [x] `hooks/useCanvasLock.md` - Lock management
- [x] `hooks/useCanvasSources.md` - Sources/models fetching
- [x] `hooks/useGitIntegration.md` - GitHub integration
- [x] `hooks/useWorkflowExecution.md` - Workflow execution
- [x] `hooks/useColumnData.md` - Column data fetching

#### Nodes
- [x] `nodes/DbtSourceModelNode.md` - Source/model node component
- [x] `nodes/OperationNode.md` - Operation node component

#### Canvas
- [x] `canvas/Canvas.md` - Main canvas component
- [x] `canvas/CanvasHeader.md` - Canvas toolbar
- [x] `canvas/CanvasMessages.md` - Status messages overlay
- [x] `canvas/CanvasPreview.md` - Read-only preview wrapper

#### Panels
- [x] `panels/OperationConfigLayout.md` - Right panel orchestrator
- [x] `panels/CreateTableOrAddFunction.md` - Choice panel

#### Forms (18 total)
- [x] `forms/RenameColumnOpForm.md` - Rename column form
- [x] `forms/DropColumnOpForm.md` - Drop column form (checkbox list)
- [x] `forms/CastColumnOpForm.md` - Cast column form (data types)
- [x] `forms/ReplaceValueOpForm.md` - Replace value form (find/replace)
- [x] `forms/AggregationOpForm.md` - Aggregation form
- [x] `forms/GroupByOpForm.md` - Group by form (dimensions + aggregations)
- [x] `forms/ArithmeticOpForm.md` - Arithmetic form (add/sub/mul/div)
- [x] `forms/JoinOpForm.md` - Join tables form (most complex)
- [x] `forms/UnionTablesOpForm.md` - Union tables form
- [x] `forms/CoalesceOpForm.md` - Coalesce form (ordered columns)
- [x] `forms/CaseWhenOpForm.md` - Case when form (conditional logic)
- [x] `forms/WhereFilterOpForm.md` - Where filter form
- [x] `forms/PivotOpForm.md` - Pivot form
- [x] `forms/UnpivotOpForm.md` - Unpivot form (melt)
- [x] `forms/FlattenJsonOpForm.md` - Flatten JSON form
- [x] `forms/CreateTableForm.md` - Create table form (terminate chain)
- [x] `forms/GenericColumnOpForm.md` - Generic column form (custom function)
- [x] `forms/GenericSqlOpForm.md` - Generic SQL form (raw SELECT)

#### Modals
- [x] `modals/PatRequiredModal.md` - GitHub PAT authentication
- [x] `modals/PublishModal.md` - Publish to git
- [x] `modals/DiscardChangesDialog.md` - Discard changes confirmation

#### Layout
- [x] `layout/FlowEditor.md` - Main layout container
- [x] `layout/ProjectTree.md` - Source/model tree browser
- [x] `layout/LowerSectionTabs.md` - Preview, Logs, Statistics tabs

#### Utilities
- [x] `utils/dummynodes.md` - Dummy node generation utilities

---

## Next Steps: Implementation

All 44 component specifications are now complete. The project is ready for implementation.

### Recommended Implementation Order

#### Phase 1: Foundation (no UI)
1. Implement types and constants
2. Implement Zustand canvas store
3. Implement all API hooks

#### Phase 2: Core Visual
4. Implement DbtSourceModelNode
5. Implement OperationNode
6. Implement Canvas with basic functionality

#### Phase 3: Operation Forms (largest effort)
7. Start with simple forms (Rename, Drop)
8. Then aggregation forms
9. Then complex multi-table forms (Join, Union)
10. Then conditional forms (CaseWhen, Where)

#### Phase 4: Integration
11. Implement OperationConfigLayout
12. Implement FlowEditor with tabs
13. Implement modals

#### Phase 5: Polish
14. Edge cases and error handling
15. Testing
16. Review

Each component should be implemented following its specification document.
