// types/transform.ts

import {
  OperationFormAction,
  WhereFilterType,
  CaseWhenType,
  JoinType,
  CanvasActionEnum,
  RENAME_COLUMNS_OP,
  DROP_COLUMNS_OP,
  CAST_DATA_TYPES_OP,
  REPLACE_COLUMN_VALUE_OP,
  AGGREGATE_OP,
  GROUPBY_OP,
  ARITHMETIC_OP,
  COALESCE_COLUMNS_OP,
  JOIN_OP,
  UNION_OP,
  WHERE_OP,
  CASEWHEN_OP,
  PIVOT_OP,
  UNPIVOT_OP,
  FLATTEN_JSON_OP,
  GENERIC_COL_OP,
  GENERIC_SQL_OP,
} from '@/constants/transform';
import { TableType } from '@/constants/explore';
import { TaskProgressStatus } from '@/constants/pipeline';

// ============================================
// WORKSPACE & SETUP
// ============================================

export type TransformType = 'github' | 'ui' | 'none' | 'dbtcloud' | null;

export interface TransformTypeResponse {
  transform_type: TransformType;
}

export interface DbtWorkspace {
  gitrepo_url: string | null;
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
// TASKS
// ============================================

export interface TransformTask {
  uuid: string;
  label: string;
  slug: string;
  type: string;
  command: string;
  generated_by: 'system' | 'client';
  deploymentId: string;
  deploymentName: string;
  cron?: string | null;
  lock?: {
    status: string;
    flowRunId: string;
    celeryTaskId: string;
    lockedBy: string;
    lockedAt: string;
  } | null;
  lastRun?: {
    startTime: string;
    endTime?: string;
    status: string;
  } | null;
}

export interface TaskProgress {
  status: TaskProgressStatus;
  message: string;
  timestamp: string;
  results?: unknown;
}

export interface PrefectFlowRun {
  id: string;
  name: string;
  deployment_id: string;
  flow_id: string;
  state_type: string;
  state_name: string;
}

export interface PrefectFlowRunLog {
  level: number;
  timestamp: string;
  message: string;
}

// ============================================
// SOURCES & MODELS
// ============================================

export interface DbtModelResponse {
  id: string;
  name: string;
  schema: string;
  type: TableType;
  display_name: string;
  source_name: string;
  sql_path: string;
  output_cols: string[];
  uuid: string;
  rel_dir_to_models?: string;
}

// ============================================
// CANVAS ENUMS & ACTION TYPES
// ============================================

export enum CanvasNodeTypeEnum {
  Source = 'source',
  Model = 'model',
  Operation = 'operation',
}

export type CanvasActionType = CanvasActionEnum | '' | null;

export interface CanvasAction {
  type: CanvasActionType;
  data: unknown;
}

// ============================================
// CANVAS API RESPONSE TYPES
// ============================================

export interface OperationConfigResponseJson {
  type: string;
  config: AnyOperationConfig;
  [key: string]: unknown;
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

export interface CanvasEdgeDataResponse {
  source: string;
  target: string;
  id: string;
}

export interface DbtProjectGraphResponse {
  nodes: CanvasNodeDataResponse[];
  edges: CanvasEdgeDataResponse[];
}

// ============================================
// CANVAS API PAYLOAD TYPES
// ============================================

export interface ModelSrcOtherInputPayload {
  input_model_uuid: string;
  columns: string[];
  seq: number;
}

export interface CreateOperationNodePayload {
  op_type: string;
  config: Record<string, unknown>;
  input_node_uuid: string;
  source_columns: string[];
  other_inputs: ModelSrcOtherInputPayload[];
}

export interface EditOperationNodePayload {
  op_type: string;
  config: Record<string, unknown>;
  source_columns: string[];
  other_inputs: ModelSrcOtherInputPayload[];
}

export interface TerminateChainAndCreateModelPayload {
  name: string;
  display_name: string;
  dest_schema: string;
  rel_dir_to_models?: string;
}

// ============================================
// REACT FLOW NODE TYPES
// ============================================

import type { Node, NodeProps, Edge } from 'reactflow';

export interface CanvasNodeRenderData extends CanvasNodeDataResponse {
  isDummy: boolean;
}

export interface CanvasNodeRender {
  id: string;
  type: CanvasNodeTypeEnum;
  data: CanvasNodeRenderData;
  position: { x: number; y: number };
}

export type GenericNode = Node<CanvasNodeRenderData>;
export type GenericNodeProps = NodeProps<CanvasNodeRenderData>;
export type GenericEdge = Edge<CanvasEdgeDataResponse>;

/** Subset of NodeProps stored in the transform store for the selected node */
export interface SelectedNodeData {
  id: string;
  type: string;
  data: CanvasNodeRenderData;
  selected?: boolean;
  /** Canvas position — stored so dummy nodes can be placed relative to it
   *  without needing to look up the node in React Flow state (matches v1's xPos/yPos) */
  position?: { x: number; y: number };
}

// ============================================
// OPERATION UI TYPES
// ============================================

export interface UIOperationType {
  slug: string;
  label: string;
  infoToolTip?: string;
}

export interface OperationFormProps {
  node: SelectedNodeData | null | undefined;
  operation: UIOperationType;
  continueOperationChain: (...args: unknown[]) => void;
  clearAndClosePanel?: (...args: unknown[]) => void;
  dummyNodeId?: string;
  action: OperationFormAction;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

// ============================================
// OPERATION CONFIG TYPES
// ============================================

export interface RenameDataConfig {
  columns: { [key: string]: string };
  source_columns: string[];
}

export interface DropDataConfig {
  columns: string[];
  source_columns: string[];
}

export interface CastDataConfig {
  source_columns: string[];
  columns: { columnname: string; columntype: string }[];
}

export interface ReplaceOp {
  find: string;
  replace: string;
}

export interface ReplaceDataConfig {
  source_columns: string[];
  columns: {
    col_name: string;
    output_column_name: string;
    replace_ops: ReplaceOp[];
  }[];
}

export interface AggregateOn {
  column: string;
  operation: 'sum' | 'avg' | 'count' | 'countdistinct' | 'max' | 'min';
  output_column_name: string;
}

export interface AggregateDataConfig {
  aggregate_on: AggregateOn[];
  source_columns: string[];
}

export interface GroupbyDataConfig {
  aggregate_on: AggregateOn[];
  dimension_columns: string[];
  source_columns: string[];
}

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

export interface CoalesceDataConfig {
  columns: string[];
  source_columns: string[];
  default_value: string;
  output_column_name: string;
}

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
  join_type: JoinType;
  join_on: {
    key1: string;
    key2: string;
    compare_with: string;
  };
  source_columns: string[];
}

export interface UnionDataConfig {
  source_columns: string[];
}

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
  where_type: WhereFilterType;
  clauses: WhereClause[];
  sql_snippet: string;
  source_columns: string[];
}

export interface WhenClause {
  column: string;
  operands: GenericOperand[];
  operator: string;
  then: GenericOperand;
}

export interface CasewhenDataConfig {
  case_type: CaseWhenType;
  else_clause: GenericOperand;
  when_clauses: WhenClause[];
  sql_snippet: string;
  output_column_name: string;
  source_columns: string[];
}

export interface PivotDataConfig {
  groupby_columns: string[];
  pivot_column_name: string;
  pivot_column_values: string[];
  source_columns: string[];
}

export interface UnpivotDataConfig {
  source_columns: string[];
  exclude_columns: string[];
  unpivot_columns: string[];
  unpivot_field_name: string;
  unpivot_value_name: string;
}

export interface FlattenJsonDataConfig {
  source_columns: string[];
  json_column: string;
  json_columns_to_copy: string[];
  source_schema: string;
}

export interface GenericCol {
  function_name: string;
  operands: { value: string | number; is_col: boolean }[];
  output_column_name: string;
}

export interface GenericColDataConfig {
  computed_columns: GenericCol[];
  source_columns: string[];
}

export interface GenericSqlDataConfig {
  columns: string[];
  source_columns: string[];
  sql_statement_1: string;
  sql_statement_2: string;
}

// ============================================
// DISCRIMINATED UNION FOR OPERATION CONFIGS
// ============================================

/**
 * Maps each operation slug to its strongly-typed config.
 * Used to narrow `operation_config.config` without unsafe casts.
 */
export interface OperationConfigMap {
  [RENAME_COLUMNS_OP]: RenameDataConfig;
  [DROP_COLUMNS_OP]: DropDataConfig;
  [CAST_DATA_TYPES_OP]: CastDataConfig;
  [REPLACE_COLUMN_VALUE_OP]: ReplaceDataConfig;
  [AGGREGATE_OP]: AggregateDataConfig;
  [GROUPBY_OP]: GroupbyDataConfig;
  [ARITHMETIC_OP]: ArithmeticDataConfig;
  [COALESCE_COLUMNS_OP]: CoalesceDataConfig;
  [JOIN_OP]: JoinDataConfig;
  [UNION_OP]: UnionDataConfig;
  [WHERE_OP]: WherefilterDataConfig;
  [CASEWHEN_OP]: CasewhenDataConfig;
  [PIVOT_OP]: PivotDataConfig;
  [UNPIVOT_OP]: UnpivotDataConfig;
  [FLATTEN_JSON_OP]: FlattenJsonDataConfig;
  [GENERIC_COL_OP]: GenericColDataConfig;
  [GENERIC_SQL_OP]: GenericSqlDataConfig;
}

export type OperationSlug = keyof OperationConfigMap;
export type AnyOperationConfig = OperationConfigMap[OperationSlug];

/**
 * Per-operation submit config map — strips source_columns from each config
 * since source_columns is sent at the payload level, not inside config.
 */
export type OperationSubmitConfigMap = {
  [K in OperationSlug]: Omit<OperationConfigMap[K], 'source_columns'>;
};

/**
 * Outgoing config type — what forms submit (without source_columns,
 * which is sent at the payload level, not inside config).
 */
export type OperationSubmitConfig = OperationSubmitConfigMap[OperationSlug];

/**
 * Type-safe operation payload — links op_type to its specific config shape.
 * If you change the op_type, TypeScript will enforce the matching config.
 */
export interface TypedOperationPayload<T extends OperationSlug> {
  op_type: T;
  config: OperationSubmitConfigMap[T];
  source_columns: string[];
  other_inputs?: ModelSrcOtherInputPayload[];
}

/**
 * Type-safe helper to narrow operation config by slug.
 * Usage: const config = getTypedConfig<'arithmetic'>(node.data.operation_config);
 */
export function getTypedConfig<T extends OperationSlug>(
  _slug: T,
  operationConfig: OperationConfigResponseJson | undefined
): OperationConfigMap[T] | undefined {
  if (!operationConfig?.config) return undefined;
  return operationConfig.config as OperationConfigMap[T];
}

// ============================================
// PREVIEW & DISPLAY TYPES
// ============================================

export interface PreviewTableData {
  table: string;
  schema: string;
}

export interface ColumnData {
  name: string;
  data_type: string;
}

// ============================================
// CANVAS LOCK & LOG TYPES
// ============================================

export interface CanvasLockStatus {
  locked_by: string | null;
  locked_at: string | null;
  is_locked: boolean;
  locked_by_current_user: boolean;
  lock_id: string | null;
}

export interface TaskProgressLog {
  message: string;
  status: string;
  timestamp: string;
}

export interface PreviewAction {
  type: 'preview' | 'clear-preview' | null;
  data: PreviewTableData | null;
}
