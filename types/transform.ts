// types/transform.ts

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
  status: 'pending' | 'running' | 'completed' | 'failed' | 'error';
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
  type: 'source' | 'model';
  display_name: string;
  source_name: string;
  sql_path: string;
  output_cols: string[];
  uuid: string;
}

// ============================================
// CANVAS ENUMS & ACTION TYPES
// ============================================

export enum CanvasNodeTypeEnum {
  Source = 'source',
  Model = 'model',
  Operation = 'operation',
}

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
  | 'focus-node'
  | ''
  | null;

export interface CanvasAction {
  type: CanvasActionType;
  data: unknown;
}

// ============================================
// CANVAS API RESPONSE TYPES
// ============================================

export interface OperationConfigResponseJson {
  type: string;
  config: Record<string, unknown>;
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

// ============================================
// OPERATION UI TYPES
// ============================================

export interface UIOperationType {
  slug: string;
  label: string;
  infoToolTip?: string;
}

export interface OperationFormProps {
  node: GenericNodeProps | null | undefined;
  operation: UIOperationType;
  continueOperationChain: (...args: unknown[]) => void;
  clearAndClosePanel?: (...args: unknown[]) => void;
  dummyNodeId?: string;
  action: 'create' | 'view' | 'edit';
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
  other_inputs: unknown[];
}

export interface CastDataConfig {
  source_columns: string[];
  other_inputs: unknown[];
  columns: { columnname: string; columntype: string }[];
}

export interface ReplaceOp {
  find: string;
  replace: string;
}

export interface ReplaceDataConfig {
  source_columns: string[];
  other_inputs: unknown[];
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
  other_inputs: unknown[];
}

export interface GroupbyDataConfig {
  aggregate_on: AggregateOn[];
  dimension_columns: string[];
  source_columns: string[];
  other_inputs: unknown[];
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
  other_inputs: unknown[];
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
  join_type: 'left' | 'inner' | 'full outer';
  join_on: {
    key1: string;
    key2: string;
    compare_with: string;
  };
  other_inputs: SecondaryInput[];
  source_columns: string[];
}

export interface UnionDataConfig {
  other_inputs: SecondaryInput[];
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
  where_type: 'and' | 'or' | 'sql';
  clauses: WhereClause[];
  sql_snippet: string;
  source_columns: string[];
  other_inputs: unknown[];
}

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
  other_inputs: unknown[];
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
  other_inputs: unknown[];
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
  other_inputs: unknown[];
}

export interface GenericSqlDataConfig {
  columns: string[];
  source_columns: string[];
  sql_statement_1: string;
  other_inputs: unknown[];
  sql_statement_2: string;
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
