// components/transform/canvas/__tests__/canvas-mock-data.ts
// Mock data factories for Transform Canvas tests

import type {
  DbtModelResponse,
  CanvasNodeDataResponse,
  CanvasEdgeDataResponse,
  DbtProjectGraphResponse,
  CanvasLockStatus,
  TaskProgressLog,
  ColumnData,
  UIOperationType,
  GenericNode,
  GenericEdge,
} from '@/types/transform';
import { CanvasNodeTypeEnum } from '@/types/transform';
import { TableType } from '@/constants/explore';
import { TaskProgressStatus } from '@/constants/pipeline';

// ============================================
// ID GENERATORS
// ============================================

let nodeIdCounter = 1;
let edgeIdCounter = 1;

export function resetIdCounters() {
  nodeIdCounter = 1;
  edgeIdCounter = 1;
}

function generateUUID(): string {
  return `uuid-${nodeIdCounter++}-${Date.now()}`;
}

function generateEdgeId(): string {
  return `edge-${edgeIdCounter++}`;
}

// ============================================
// DBT MODEL FACTORIES
// ============================================

export function createMockDbtModel(overrides: Partial<DbtModelResponse> = {}): DbtModelResponse {
  const id = generateUUID();
  return {
    id,
    uuid: id,
    name: `model_${nodeIdCounter}`,
    schema: 'public',
    type: TableType.MODEL,
    display_name: `Model ${nodeIdCounter}`,
    source_name: 'main_source',
    sql_path: `models/staging/model_${nodeIdCounter}.sql`,
    output_cols: ['id', 'name', 'created_at'],
    ...overrides,
  };
}

export function createMockSource(overrides: Partial<DbtModelResponse> = {}): DbtModelResponse {
  return createMockDbtModel({
    type: TableType.SOURCE,
    name: `source_${nodeIdCounter}`,
    display_name: `Source ${nodeIdCounter}`,
    ...overrides,
  });
}

// ============================================
// CANVAS NODE FACTORIES
// ============================================

export function createMockCanvasNode(
  overrides: Partial<CanvasNodeDataResponse> = {}
): CanvasNodeDataResponse {
  const uuid = overrides.uuid || generateUUID();
  return {
    uuid,
    name: `node_${uuid}`,
    output_columns: ['id', 'name', 'value'],
    node_type: CanvasNodeTypeEnum.Model,
    dbtmodel: createMockDbtModel({ uuid }),
    operation_config: { type: '', config: {} },
    is_last_in_chain: false,
    isPublished: true,
    seq: 0,
    ...overrides,
  };
}

export function createMockSourceNode(
  overrides: Partial<CanvasNodeDataResponse> = {}
): CanvasNodeDataResponse {
  return createMockCanvasNode({
    node_type: CanvasNodeTypeEnum.Source,
    dbtmodel: createMockSource(),
    ...overrides,
  });
}

export function createMockOperationNode(
  opType: string,
  config: Record<string, unknown> = {},
  overrides: Partial<CanvasNodeDataResponse> = {}
): CanvasNodeDataResponse {
  return createMockCanvasNode({
    node_type: CanvasNodeTypeEnum.Operation,
    dbtmodel: null,
    operation_config: { type: opType, config },
    ...overrides,
  });
}

// ============================================
// EDGE FACTORIES
// ============================================

export function createMockEdge(
  source: string,
  target: string,
  overrides: Partial<CanvasEdgeDataResponse> = {}
): CanvasEdgeDataResponse {
  return {
    id: generateEdgeId(),
    source,
    target,
    ...overrides,
  };
}

// ============================================
// GRAPH FACTORIES
// ============================================

export function createMockGraph(nodeCount = 3): DbtProjectGraphResponse {
  const nodes: CanvasNodeDataResponse[] = [];
  const edges: CanvasEdgeDataResponse[] = [];

  // Create source node
  const sourceNode = createMockSourceNode({ name: 'raw_customers' });
  nodes.push(sourceNode);

  // Create intermediate nodes and connect them
  let prevNodeId = sourceNode.uuid;
  for (let i = 1; i < nodeCount; i++) {
    const isOperation = i % 2 === 1;
    const node = isOperation
      ? createMockOperationNode('rename', { columns: { old_col: 'new_col' } })
      : createMockCanvasNode({ name: `model_${i}` });

    nodes.push(node);
    edges.push(createMockEdge(prevNodeId, node.uuid));
    prevNodeId = node.uuid;
  }

  // Mark last node
  if (nodes.length > 0) {
    nodes[nodes.length - 1].is_last_in_chain = true;
  }

  return { nodes, edges };
}

export function createEmptyGraph(): DbtProjectGraphResponse {
  return { nodes: [], edges: [] };
}

// ============================================
// REACT FLOW NODE FACTORIES
// ============================================

export function createMockReactFlowNode(overrides: Partial<GenericNode> = {}): GenericNode {
  const canvasNode = createMockCanvasNode();
  return {
    id: canvasNode.uuid,
    type: 'dbtSourceModel',
    position: { x: 100, y: 100 },
    data: {
      ...canvasNode,
      isDummy: false,
    },
    ...overrides,
  };
}

export function createMockReactFlowEdge(
  source: string,
  target: string,
  overrides: Partial<GenericEdge> = {}
): GenericEdge {
  return {
    id: generateEdgeId(),
    source,
    target,
    ...overrides,
  };
}

// ============================================
// LOCK STATUS FACTORIES
// ============================================

export function createMockLockStatus(overrides: Partial<CanvasLockStatus> = {}): CanvasLockStatus {
  return {
    is_locked: false,
    locked_by: null,
    locked_at: null,
    locked_by_current_user: false,
    lock_id: null,
    ...overrides,
  };
}

export function createLockedByCurrentUser(): CanvasLockStatus {
  return createMockLockStatus({
    is_locked: true,
    locked_by: 'current-user@example.com',
    locked_at: new Date().toISOString(),
    locked_by_current_user: true,
    lock_id: 'lock-123',
  });
}

export function createLockedByOtherUser(): CanvasLockStatus {
  return createMockLockStatus({
    is_locked: true,
    locked_by: 'other-user@example.com',
    locked_at: new Date().toISOString(),
    locked_by_current_user: false,
    lock_id: 'lock-456',
  });
}

// ============================================
// LOG FACTORIES
// ============================================

export function createMockTaskLog(overrides: Partial<TaskProgressLog> = {}): TaskProgressLog {
  return {
    message: 'Processing...',
    status: TaskProgressStatus.RUNNING,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockLogSequence(): TaskProgressLog[] {
  const baseTime = Date.now();
  return [
    {
      message: 'Starting workflow...',
      status: TaskProgressStatus.RUNNING,
      timestamp: new Date(baseTime).toISOString(),
    },
    {
      message: 'Running dbt models...',
      status: TaskProgressStatus.RUNNING,
      timestamp: new Date(baseTime + 1000).toISOString(),
    },
    {
      message: 'Completed successfully',
      status: TaskProgressStatus.COMPLETED,
      timestamp: new Date(baseTime + 5000).toISOString(),
    },
  ];
}

export function createFailedLogSequence(): TaskProgressLog[] {
  const baseTime = Date.now();
  return [
    {
      message: 'Starting workflow...',
      status: TaskProgressStatus.RUNNING,
      timestamp: new Date(baseTime).toISOString(),
    },
    {
      message: 'Error: Model compilation failed',
      status: TaskProgressStatus.FAILED,
      timestamp: new Date(baseTime + 2000).toISOString(),
    },
  ];
}

// ============================================
// COLUMN DATA FACTORIES
// ============================================

export function createMockColumn(overrides: Partial<ColumnData> = {}): ColumnData {
  return {
    name: 'column_1',
    data_type: 'VARCHAR',
    ...overrides,
  };
}

export function createMockColumns(count = 5): ColumnData[] {
  const types = ['VARCHAR', 'INTEGER', 'BOOLEAN', 'TIMESTAMP', 'FLOAT'];
  return Array.from({ length: count }, (_, i) => ({
    name: `column_${i + 1}`,
    data_type: types[i % types.length],
  }));
}

// ============================================
// OPERATION TYPE FACTORIES
// ============================================

export function createMockOperation(overrides: Partial<UIOperationType> = {}): UIOperationType {
  return {
    slug: 'rename',
    label: 'Rename Column',
    infoToolTip: 'Rename one or more columns',
    ...overrides,
  };
}

export function createAllOperations(): UIOperationType[] {
  return [
    {
      slug: 'castdatatypes',
      label: 'Cast Data Type',
      infoToolTip: 'Cast column to different type',
    },
    { slug: 'renamecolumns', label: 'Rename Columns', infoToolTip: 'Rename one or more columns' },
    { slug: 'dropcolumns', label: 'Drop Columns', infoToolTip: 'Remove columns from output' },
    {
      slug: 'coalescecolumns',
      label: 'Coalesce Columns',
      infoToolTip: 'Combine columns with fallback',
    },
    { slug: 'concat', label: 'Concatenate', infoToolTip: 'Concatenate column values' },
    { slug: 'arithmetic', label: 'Arithmetic', infoToolTip: 'Mathematical operations' },
    { slug: 'regexextraction', label: 'Regex Extract', infoToolTip: 'Extract using regex' },
    { slug: 'flattenjson', label: 'Flatten JSON', infoToolTip: 'Flatten JSON structure' },
    { slug: 'casewhen', label: 'Case When', infoToolTip: 'Conditional logic' },
    { slug: 'aggregate', label: 'Aggregate', infoToolTip: 'Aggregate operations' },
    { slug: 'groupby', label: 'Group By', infoToolTip: 'Group and aggregate' },
    { slug: 'where', label: 'Where Filter', infoToolTip: 'Filter rows' },
    { slug: 'join', label: 'Join Tables', infoToolTip: 'Join multiple tables' },
    { slug: 'unionall', label: 'Union Tables', infoToolTip: 'Union multiple tables' },
    { slug: 'pivot', label: 'Pivot', infoToolTip: 'Pivot rows to columns' },
    { slug: 'unpivot', label: 'Unpivot', infoToolTip: 'Unpivot columns to rows' },
    { slug: 'replace', label: 'Replace Values', infoToolTip: 'Find and replace values' },
  ];
}

// ============================================
// GIT STATUS FACTORIES
// ============================================

export interface GitStatus {
  added: string[];
  modified: string[];
  deleted: string[];
}

export function createMockGitStatus(overrides: Partial<GitStatus> = {}): GitStatus {
  return {
    added: [],
    modified: [],
    deleted: [],
    ...overrides,
  };
}

export function createMockGitStatusWithChanges(): GitStatus {
  return {
    added: ['models/staging/stg_orders.sql', 'models/staging/stg_customers.sql'],
    modified: ['models/marts/dim_products.sql'],
    deleted: ['models/staging/old_model.sql'],
  };
}

// ============================================
// SOURCES/MODELS LIST FACTORIES
// ============================================

export function createMockSourcesModelsList(count = 5): DbtModelResponse[] {
  const schemas = ['raw_data', 'staging', 'marts'];
  return Array.from({ length: count }, (_, i) => {
    const schema = schemas[i % schemas.length];
    const type = i < 2 ? TableType.SOURCE : TableType.MODEL;
    return createMockDbtModel({
      name: `${type === TableType.SOURCE ? 'src' : 'stg'}_table_${i + 1}`,
      schema,
      type,
    });
  });
}
