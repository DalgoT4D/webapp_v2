# Types and Constants Specification

## Overview

This document specifies all TypeScript types, interfaces, enums, and constants required for the Transform Canvas feature migration from webapp v1 to v2.

**v1 Source Files:**
- `webapp/src/types/transform-v2.types.ts`
- `webapp/src/components/TransformWorkflow/FlowEditor/constant.ts`
- `webapp/src/contexts/FlowEditorCanvasContext.tsx`
- Various operation form files

**v2 Target Location:** `webapp_v2/src/types/transform.types.ts`

---

## 1. Core Enums

### CanvasNodeTypeEnum
```typescript
export enum CanvasNodeTypeEnum {
  Source = 'source',
  Model = 'model',
  Operation = 'operation',
}
```

### CanvasActionTypeEnum
```typescript
export type CanvasActionType =
  | 'add-srcmodel-node'
  | 'delete-node'
  | 'delete-source-tree-node'
  | 'refresh-canvas'
  | 'open-opconfig-panel'
  | 'close-reset-opconfig-panel'
  | 'sync-sources'
  | 'run-workflow'
  | 'update-canvas-node'
  | ''
  | null;
```

---

## 2. Operation Type Constants

### Operation Slugs
```typescript
export const RENAME_COLUMNS_OP = 'renamecolumns';
export const FLATTEN_OP = 'flatten';
export const FLATTEN_JSON_OP = 'flattenjson';
export const CAST_DATA_TYPES_OP = 'castdatatypes';
export const COALESCE_COLUMNS_OP = 'coalescecolumns';
export const ARITHMETIC_OP = 'arithmetic';
export const CONCAT_COLUMNS_OP = 'concat';
export const DROP_COLUMNS_OP = 'dropcolumns';
export const REGEX_EXTRACTION_OP = 'regexextraction';
export const REPLACE_COLUMN_VALUE_OP = 'replace';
export const JOIN_OP = 'join';
export const WHERE_OP = 'where';
export const GROUPBY_OP = 'groupby';
export const AGGREGATE_OP = 'aggregate';
export const CASEWHEN_OP = 'casewhen';
export const UNION_OP = 'unionall';
export const PIVOT_OP = 'pivot';
export const UNPIVOT_OP = 'unpivot';
export const GENERIC_COL_OP = 'generic';
export const GENERIC_SQL_OP = 'rawsql';
```

### Operations Array (17 operations, sorted alphabetically)
```typescript
export interface UIOperationType {
  slug: string;
  label: string;
  infoToolTip?: string;
}

export const operations: UIOperationType[] = [
  {
    label: 'Aggregate',
    slug: AGGREGATE_OP,
    infoToolTip: 'Performs a calculation on multiple values in a column and returns a new column with that value in every row',
  },
  {
    label: 'Arithmetic',
    slug: ARITHMETIC_OP,
    infoToolTip: 'Perform arithmetic operations on or between one or more columns',
  },
  {
    label: 'Case',
    slug: CASEWHEN_OP,
    infoToolTip: 'Select the relevant column, operation, and comparison column or value',
  },
  {
    label: 'Cast',
    slug: CAST_DATA_TYPES_OP,
    infoToolTip: "Convert a column's values (of any type) into a specified datatype",
  },
  {
    label: 'Coalesce',
    slug: COALESCE_COLUMNS_OP,
    infoToolTip: 'Reads columns in the order selected and returns the first non-NULL value from a series of columns',
  },
  {
    label: 'Drop',
    slug: DROP_COLUMNS_OP,
    infoToolTip: 'Select the columns that you would like to remove from the table',
  },
  {
    label: 'Filter',
    slug: WHERE_OP,
    infoToolTip: 'Filters all the row values in the selected column based on the defined condition',
  },
  {
    label: 'Flatten JSON',
    slug: FLATTEN_JSON_OP,
    infoToolTip: 'Transforms JSON formatted data into Tabular formatted data',
  },
  {
    label: 'Generic Column',
    slug: GENERIC_COL_OP,
    infoToolTip: 'Add a generic column operation',
  },
  {
    label: 'Generic SQL',
    slug: GENERIC_SQL_OP,
    infoToolTip: 'Add a generic sql operation',
  },
  {
    label: 'Group By',
    slug: GROUPBY_OP,
    infoToolTip: 'Group your data by one or more dimensions and analyse it',
  },
  {
    label: 'Join',
    slug: JOIN_OP,
    infoToolTip: 'Combine rows from two or more tables, based on a related (key) column between them',
  },
  {
    label: 'Pivot',
    slug: PIVOT_OP,
    infoToolTip: 'Pivot table data based on values of selected column',
  },
  {
    label: 'Rename',
    slug: RENAME_COLUMNS_OP,
    infoToolTip: 'Select columns and rename them',
  },
  {
    label: 'Replace',
    slug: REPLACE_COLUMN_VALUE_OP,
    infoToolTip: 'Replace all the row values in a column having a specified string with a new value',
  },
  {
    label: 'Table union',
    slug: UNION_OP,
    infoToolTip: 'Combine data for matching columns across two datasets',
  },
  {
    label: 'Unpivot',
    slug: UNPIVOT_OP,
    infoToolTip: 'Unpivot columns & values of a table into rows',
  },
];
```

### Operation Icon Mapping
```typescript
// Icons will be in: webapp_v2/public/icons/transform/
export const operationIconMapping: Record<string, string> = {
  [RENAME_COLUMNS_OP]: '/icons/transform/rename.svg',
  [FLATTEN_OP]: '/icons/transform/flatten.svg',
  [FLATTEN_JSON_OP]: '/icons/transform/flatten.svg',
  [CAST_DATA_TYPES_OP]: '/icons/transform/cast.svg',
  [COALESCE_COLUMNS_OP]: '/icons/transform/coalesce.svg',
  [ARITHMETIC_OP]: '/icons/transform/arithmetic.svg',
  [CONCAT_COLUMNS_OP]: '/icons/transform/concat.svg',
  [DROP_COLUMNS_OP]: '/icons/transform/drop.svg',
  [REPLACE_COLUMN_VALUE_OP]: '/icons/transform/replace.svg',
  [JOIN_OP]: '/icons/transform/join.svg',
  [WHERE_OP]: '/icons/transform/filter.svg',
  [GROUPBY_OP]: '/icons/transform/groupby.svg',
  [AGGREGATE_OP]: '/icons/transform/aggregate.svg',
  [CASEWHEN_OP]: '/icons/transform/case.svg',
  [UNION_OP]: '/icons/transform/union.svg',
  [PIVOT_OP]: '/icons/transform/pivot.svg',
  [UNPIVOT_OP]: '/icons/transform/unpivot.svg',
  [GENERIC_COL_OP]: '/icons/transform/generic.svg',
  [GENERIC_SQL_OP]: '/icons/transform/generic.svg',
};
```

---

## 3. API Response Types

### DbtModelResponse
```typescript
export interface DbtModelResponse {
  name: string;
  display_name: string;
  schema: string;
  sql_path: string;
  type: 'source' | 'model';
  source_name: string;
  output_cols: string[];
  uuid: string;
}
```

### CanvasNodeDataResponse
```typescript
export interface OperationConfigResponseJson {
  type: string;
  config: any;
  [key: string]: any;
}

export interface CanvasNodeDataResponse {
  uuid: string;
  name: string;
  output_columns: string[];
  node_type: CanvasNodeTypeEnum;
  dbtmodel: DbtModelResponse | null;
  operation_config: OperationConfigResponseJson;
  input_nodes?: CanvasNodeDataResponse[];
  is_last_in_chain: boolean;
  isPublished: boolean | null;
  seq?: number;
}
```

### CanvasEdgeDataResponse
```typescript
export interface CanvasEdgeDataResponse {
  source: string;
  target: string;
  id: string;
}
```

### DbtProjectGraphResponse
```typescript
export interface DbtProjectGraphResponse {
  nodes: CanvasNodeDataResponse[];
  edges: CanvasEdgeDataResponse[];
}
```

---

## 4. API Payload Types

### ModelSrcOtherInputPayload
```typescript
export interface ModelSrcOtherInputPayload {
  input_model_uuid: string;
  columns: string[];
  seq: number;
}
```

### CreateOperationNodePayload
```typescript
export interface CreateOperationNodePayload {
  op_type: string;
  config: any;
  input_node_uuid: string;
  source_columns: string[];
  other_inputs: ModelSrcOtherInputPayload[];
}
```

### EditOperationNodePayload
```typescript
export interface EditOperationNodePayload {
  op_type: string;
  config: any;
  source_columns: string[];
  other_inputs: ModelSrcOtherInputPayload[];
}
```

### TerminateChainAndCreateModelPayload
```typescript
export interface TerminateChainAndCreateModelPayload {
  name: string;
  display_name: string;
  dest_schema: string;
  rel_dir_to_models?: string;
}
```

---

## 5. React Flow Types

### CanvasNodeRenderData
```typescript
export interface CanvasNodeRenderData extends CanvasNodeDataResponse {
  isDummy: boolean;
}
```

### CanvasNodeRender (for React Flow)
```typescript
import type { Node, NodeProps, Edge } from '@xyflow/react';

export interface CanvasNodeRender {
  id: string;
  type: CanvasNodeTypeEnum;
  data: CanvasNodeRenderData;
  position: { x: number; y: number };
}

export type GenericNode = Node<CanvasNodeRenderData>;
export type GenericNodeProps = NodeProps<CanvasNodeRenderData>;
export type GenericEdge = Edge<CanvasEdgeDataResponse>;
```

---

## 6. Operation Config Types (per form)

### RenameDataConfig
```typescript
export interface RenameDataConfig {
  columns: { [key: string]: string }; // { oldName: newName }
  source_columns: string[];
}
```

### DropDataConfig
```typescript
export interface DropDataConfig {
  columns: string[];
  source_columns: string[];
  other_inputs: any[];
}
```

### CastDataConfig
```typescript
export interface CastDataConfig {
  source_columns: string[];
  other_inputs: any[];
  columns: { columnname: string; columntype: string }[];
}
```

### ReplaceDataConfig
```typescript
export interface ReplaceOp {
  find: string;
  replace: string;
}

export interface ReplaceDataConfig {
  source_columns: string[];
  other_inputs: any[];
  columns: {
    col_name: string;
    output_column_name: string;
    replace_ops: ReplaceOp[];
  }[];
}
```

### AggregateDataConfig
```typescript
export interface AggregateOn {
  column: string;
  operation: 'sum' | 'avg' | 'count' | 'countdistinct' | 'max' | 'min';
  output_column_name: string;
}

export interface AggregateDataConfig {
  aggregate_on: AggregateOn[];
  source_columns: string[];
  other_inputs: any[];
}
```

### GroupbyDataConfig
```typescript
export interface GroupbyDataConfig {
  aggregate_on: AggregateOn[];
  dimension_columns: string[];
  source_columns: string[];
  other_inputs: any[];
}
```

### ArithmeticDataConfig
```typescript
export interface ArithmeticOperand {
  value: string | number;
  is_col: boolean;
}

export interface ArithmeticDataConfig {
  operands: ArithmeticOperand[];
  operator: 'add' | 'sub' | 'mul' | 'div';
  source_columns: string[];
  output_column_name: string;
}
```

### CoalesceDataConfig
```typescript
export interface CoalesceDataConfig {
  columns: string[];
  source_columns: string[];
  default_value: string;
  other_inputs: any[];
  output_column_name: string;
}
```

### JoinDataConfig
```typescript
export interface SecondaryInput {
  input: {
    input_name: string;
    input_type: string;
    source_name: string;
  };
  seq: number;
  source_columns: string[];
}

export interface JoinDataConfig {
  join_type: 'left' | 'inner' | 'full outer';
  join_on: {
    key1: string;
    key2: string;
    compare_with: string;
  };
  other_inputs: SecondaryInput[];
  source_columns: string[];
}
```

### UnionDataConfig
```typescript
export interface UnionDataConfig {
  other_inputs: SecondaryInput[];
  source_columns: string[];
}
```

### WherefilterDataConfig
```typescript
export interface GenericOperand {
  value: string;
  is_col: boolean;
}

export interface WhereClause {
  column: string;
  operand: GenericOperand;
  operator: string;
}

export interface WherefilterDataConfig {
  where_type: 'and' | 'or' | 'sql';
  clauses: WhereClause[];
  sql_snippet: string;
  source_columns: string[];
  other_inputs: any[];
}
```

### CasewhenDataConfig
```typescript
export interface WhenClause {
  column: string;
  operands: GenericOperand[];
  operator: string;
  then: GenericOperand;
}

export interface CasewhenDataConfig {
  case_type: 'simple' | 'advance';
  else_clause: GenericOperand;
  when_clauses: WhenClause[];
  sql_snippet: string;
  output_column_name: string;
  source_columns: string[];
  other_inputs: any[];
}
```

### PivotDataConfig
```typescript
export interface PivotDataConfig {
  groupby_columns: string[];
  pivot_column_name: string;
  pivot_column_values: string[];
  source_columns: string[];
}
```

### UnpivotDataConfig
```typescript
export interface UnpivotDataConfig {
  source_columns: string[];
  exclude_columns: string[];
  unpivot_columns: string[];
  unpivot_field_name: string;
  unpivot_value_name: string;
}
```

### FlattenJsonDataConfig
```typescript
export interface FlattenJsonDataConfig {
  source_columns: string[];
  other_inputs: any[];
  json_column: string;
  json_columns_to_copy: string[];
  source_schema: string;
}
```

### GenericColDataConfig
```typescript
export interface GenericCol {
  function_name: string;
  operands: { value: string | number; is_col: boolean }[];
  output_column_name: string;
}

export interface GenericColDataConfig {
  computed_columns: GenericCol[];
  source_columns: string[];
  other_inputs: any[];
}
```

### GenericSqlDataConfig
```typescript
export interface GenericSqlDataConfig {
  columns: string[];
  source_columns: string[];
  sql_statement_1: string;
  other_inputs: any[];
  sql_statement_2: string;
}
```

---

## 7. Form Shared Constants

### Logical Operators (for Case/Where forms)
```typescript
export const LogicalOperators = [
  { id: 'between', label: 'Between' },
  { id: '=', label: 'Equal To =' },
  { id: '>=', label: 'Greater Than or Equal To >=' },
  { id: '>', label: 'Greater Than >' },
  { id: '<', label: 'Less Than <' },
  { id: '<=', label: 'Less Than or Equal To <=' },
  { id: '!=', label: 'Not Equal To !=' },
].sort((a, b) => a.label.localeCompare(b.label));
```

### Aggregate Operations
```typescript
export const AggregateOperations = [
  { id: 'avg', label: 'Average' },
  { id: 'count', label: 'Count' },
  { id: 'countdistinct', label: 'Count Distinct' },
  { id: 'max', label: 'Maximum' },
  { id: 'min', label: 'Minimum' },
  { id: 'sum', label: 'Sum' },
].sort((a, b) => a.label.localeCompare(b.label));
```

### Arithmetic Operations
```typescript
export const ArithmeticOperations = [
  { id: 'add', label: 'Addition +' },
  { id: 'div', label: 'Division /' },
  { id: 'sub', label: 'Subtraction -' },
  { id: 'mul', label: 'Multiplication *' },
].sort((a, b) => a.label.localeCompare(b.label));
```

### Join Types
```typescript
export const JoinTypes = [
  { id: 'left', label: 'Left Join' },
  { id: 'inner', label: 'Inner Join' },
  { id: 'full outer', label: 'Full Outer Join' },
];
```

---

## 8. Component Props Types

### OperationFormProps
```typescript
export interface OperationFormProps {
  node: GenericNodeProps | null | undefined;
  operation: UIOperationType;
  continueOperationChain: (...args: any) => void;
  clearAndClosePanel?: (...args: any) => void;
  dummyNodeId?: string;
  action: 'create' | 'view' | 'edit';
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}
```

### CanvasAction
```typescript
export interface CanvasAction {
  type: CanvasActionType;
  data: any;
}
```

---

## 9. Preview/Statistics Types

### PreviewTableData
```typescript
export interface PreviewTableData {
  table: string;
  schema: string;
}
```

### ColumnData (for node display)
```typescript
export interface ColumnData {
  name: string;
  data_type: string;
}
```

---

## 10. File Organization

```
webapp_v2/src/
├── types/
│   └── transform.types.ts          # All types above
├── constants/
│   └── transform.constants.ts      # All constants above
└── components/
    └── transform/
        └── forms/
            └── shared/
                └── operators.ts    # LogicalOperators, AggregateOperations, etc.
```

---

## Implementation Checklist

- [ ] Create `types/transform.types.ts` with all interfaces and types
- [ ] Create `constants/transform.constants.ts` with all operation constants
- [ ] Copy SVG icons from v1 to `public/icons/transform/`
- [ ] Update icon paths in `operationIconMapping`
- [ ] Create shared operators file for form constants
- [ ] Verify all types compile without errors
- [ ] Add JSDoc comments for complex types

---

## Notes

1. **React Flow v12 vs v11**: v2 uses `@xyflow/react` (React Flow 12) while v1 uses `reactflow` (v11). Type imports need to be updated.

2. **Icon Migration**: Icons need to be copied from `webapp/src/assets/icons/UI4T/` to `webapp_v2/public/icons/transform/`.

3. **Type Safety**: Consider using discriminated unions for operation configs rather than `any`.

4. **Zustand Store Types**: Additional types for the canvas store will be defined in `02-canvas-store.md`.
