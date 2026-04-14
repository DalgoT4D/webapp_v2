// components/explore/__tests__/explore-mock-data.ts
import type {
  WarehouseTable,
  TableColumn,
  TableColumnWithType,
  NumericStats,
  StringStats,
  BooleanStats,
  DatetimeStats,
  TreeNode,
} from '@/types/explore';
import { TableType, TranslatedDataType } from '@/constants/explore';
import { TaskProgressStatus } from '@/constants/pipeline';

// Factory functions for mock data
export function createMockWarehouseTable(overrides: Partial<WarehouseTable> = {}): WarehouseTable {
  return {
    id: 'table-1',
    name: 'users',
    schema: 'public',
    type: TableType.SOURCE,
    ...overrides,
  };
}

export function createMockTableColumn(overrides: Partial<TableColumn> = {}): TableColumn {
  return {
    name: 'id',
    data_type: 'INTEGER',
    ...overrides,
  };
}

export function createMockTableColumnWithType(
  overrides: Partial<TableColumnWithType> = {}
): TableColumnWithType {
  return {
    name: 'id',
    translated_type: TranslatedDataType.NUMERIC,
    ...overrides,
  };
}

export function createMockNumericStats(overrides: Partial<NumericStats> = {}): NumericStats {
  return {
    minVal: 0,
    maxVal: 100,
    mean: 50,
    median: 50,
    mode: 45,
    countNull: 5,
    countDistinct: 90,
    ...overrides,
  };
}

export function createMockStringStats(overrides: Partial<StringStats> = {}): StringStats {
  return {
    count: 1000,
    countNull: 10,
    countDistinct: 500,
    minVal: 1,
    maxVal: 50,
    mean: 10,
    median: 8,
    mode: 5,
    charts: [
      {
        data: [
          { category: 'Value A', count: 300 },
          { category: 'Value B', count: 250 },
          { category: 'Value C', count: 200 },
          { category: 'Value D', count: 150 },
          { category: 'Other', count: 100 },
        ],
      },
    ],
    ...overrides,
  };
}

export function createMockBooleanStats(overrides: Partial<BooleanStats> = {}): BooleanStats {
  return {
    count: 1000,
    countTrue: 600,
    countFalse: 400,
    countNull: 0,
    countDistinct: 2,
    ...overrides,
  };
}

export function createMockDatetimeStats(overrides: Partial<DatetimeStats> = {}): DatetimeStats {
  return {
    minVal: '2020-01-01T00:00:00Z',
    maxVal: '2024-12-31T23:59:59Z',
    countNull: 5,
    countDistinct: 1500,
    charts: [
      {
        data: [
          { year: 2020, frequency: 100 },
          { year: 2021, frequency: 200 },
          { year: 2022, frequency: 300 },
          { year: 2023, frequency: 400 },
          { year: 2024, frequency: 250 },
        ],
      },
    ],
    ...overrides,
  };
}

export function createMockTreeNode(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id: 'node-1',
    schema: 'public',
    name: 'public',
    children: [
      {
        id: 'table-1',
        schema: 'public',
        name: 'users',
        type: TableType.SOURCE,
      },
      {
        id: 'table-2',
        schema: 'public',
        name: 'orders',
        type: TableType.SOURCE,
      },
    ],
    ...overrides,
  };
}

// Mock warehouse tables list
export const mockWarehouseTables: WarehouseTable[] = [
  createMockWarehouseTable({ id: 'table-1', name: 'users', schema: 'public' }),
  createMockWarehouseTable({ id: 'table-2', name: 'orders', schema: 'public' }),
  createMockWarehouseTable({
    id: 'table-3',
    name: 'products',
    schema: 'staging',
    type: TableType.MODEL,
  }),
];

// Mock table columns
export const mockTableColumns: TableColumn[] = [
  createMockTableColumn({ name: 'id', data_type: 'INTEGER' }),
  createMockTableColumn({ name: 'name', data_type: 'VARCHAR' }),
  createMockTableColumn({ name: 'email', data_type: 'VARCHAR' }),
  createMockTableColumn({ name: 'created_at', data_type: 'TIMESTAMP' }),
];

// Mock table columns with types
export const mockTableColumnsWithTypes: TableColumnWithType[] = [
  createMockTableColumnWithType({
    name: 'id',
    translated_type: TranslatedDataType.NUMERIC,
  }),
  createMockTableColumnWithType({
    name: 'name',
    translated_type: TranslatedDataType.STRING,
  }),
  createMockTableColumnWithType({
    name: 'is_active',
    translated_type: TranslatedDataType.BOOLEAN,
  }),
  createMockTableColumnWithType({
    name: 'created_at',
    translated_type: TranslatedDataType.DATETIME,
  }),
];

// Mock table data (rows)
export const mockTableData = {
  rows: [
    { id: 1, name: 'John Doe', email: 'john@example.com', created_at: '2024-01-01' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', created_at: '2024-01-02' },
    { id: 3, name: 'Bob Wilson', email: 'bob@example.com', created_at: '2024-01-03' },
  ],
};

// Mock task status response
export const mockTaskStatusPending = {
  progress: [{ status: TaskProgressStatus.RUNNING }],
};

export const mockTaskStatusCompleted = {
  progress: [
    { status: TaskProgressStatus.RUNNING },
    { status: TaskProgressStatus.COMPLETED, results: createMockNumericStats() },
  ],
};

export const mockTaskStatusFailed = {
  progress: [
    { status: TaskProgressStatus.RUNNING },
    { status: TaskProgressStatus.FAILED, error: 'Task failed' },
  ],
};
