// constants/transform.ts
// Transform Canvas operation constants

import type { UIOperationType } from '@/types/transform';

// ============================================
// OPERATION SLUGS
// ============================================

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

// ============================================
// OPERATIONS ARRAY (sorted alphabetically by label)
// ============================================

export const operations: UIOperationType[] = [
  {
    label: 'Aggregate',
    slug: AGGREGATE_OP,
    infoToolTip:
      'Performs a calculation on multiple values in a column and returns a new column with that value in every row',
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
    infoToolTip:
      'Reads columns in the order selected and returns the first non-NULL value from a series of columns',
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
    infoToolTip:
      'Combine rows from two or more tables, based on a related (key) column between them',
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
    infoToolTip:
      'Replace all the row values in a column having a specified string with a new value',
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

// ============================================
// OPERATION LABEL MAP (derived from operations array)
// ============================================

export const operationLabelMap: Record<string, string> = Object.fromEntries(
  operations.map((op) => [op.slug, op.label])
);
// Add create-table which isn't in the operations array
operationLabelMap['create-table'] = 'Create Table';

/**
 * Get the display label for an operation slug.
 */
export function getOperationLabel(slug: string): string {
  return operationLabelMap[slug] || slug;
}

// ============================================
// OPERATION ICON MAPPING
// ============================================

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

// ============================================
// OPERATIONS THAT CANNOT CHAIN IN MIDDLE
// (must create table first before using these)
// ============================================

export const OPS_REQUIRING_TABLE_FIRST = [
  UNION_OP,
  CAST_DATA_TYPES_OP,
  FLATTEN_JSON_OP,
  UNPIVOT_OP,
];

// ============================================
// FORM CONSTANTS - LOGICAL OPERATORS
// ============================================

export const LogicalOperators = [
  { id: 'between', label: 'Between' },
  { id: '=', label: 'Equal To =' },
  { id: '>=', label: 'Greater Than or Equal To >=' },
  { id: '>', label: 'Greater Than >' },
  { id: '<', label: 'Less Than <' },
  { id: '<=', label: 'Less Than or Equal To <=' },
  { id: '!=', label: 'Not Equal To !=' },
].sort((a, b) => a.label.localeCompare(b.label));

// ============================================
// FORM CONSTANTS - AGGREGATE OPERATIONS
// ============================================

export const AggregateOperations = [
  { id: 'avg', label: 'Average' },
  { id: 'count', label: 'Count' },
  { id: 'countdistinct', label: 'Count Distinct' },
  { id: 'max', label: 'Maximum' },
  { id: 'min', label: 'Minimum' },
  { id: 'sum', label: 'Sum' },
].sort((a, b) => a.label.localeCompare(b.label));

// ============================================
// FORM CONSTANTS - ARITHMETIC OPERATIONS
// ============================================

export const ArithmeticOperations = [
  { id: 'add', label: 'Addition +' },
  { id: 'div', label: 'Division /' },
  { id: 'sub', label: 'Subtraction -' },
  { id: 'mul', label: 'Multiplication *' },
].sort((a, b) => a.label.localeCompare(b.label));

// ============================================
// FORM CONSTANTS - JOIN TYPES
// ============================================

export const JoinTypes = [
  { id: 'left', label: 'Left Join' },
  { id: 'inner', label: 'Inner Join' },
  { id: 'full outer', label: 'Full Outer Join' },
];

// ============================================
// CANVAS CONSTANTS
// ============================================

export const CANVAS_CONSTANTS = {
  // Lock refresh interval (30 seconds)
  LOCK_REFRESH_INTERVAL: 30000,

  // Task polling interval (5 seconds)
  TASK_POLL_INTERVAL: 5000,

  // Node dimensions
  NODE_WIDTH: 250,

  // Panel dimensions
  PROJECT_TREE_MIN_WIDTH: 280,
  PROJECT_TREE_MAX_WIDTH: 550,
  OPERATION_PANEL_WIDTH: 400,
  LOWER_SECTION_MIN_HEIGHT: 100,
  LOWER_SECTION_DEFAULT_HEIGHT: 300,

  // Dagre layout params
  DAGRE_DIRECTION: 'LR',
  DAGRE_NODE_SEP: 200,
  DAGRE_RANK_SEP: 350,

  // Default viewport
  DEFAULT_ZOOM: 0.8,
};

// ============================================
// NODE COLORS
// ============================================

export const NODE_COLORS = {
  // Source/Model node header colors
  SOURCE_MODEL_PUBLISHED: '#00897B',
  SOURCE_MODEL_UNPUBLISHED: '#50A85C',

  // Operation node header
  OPERATION: '#1976D2',

  // Selection
  SELECTED_BORDER: '#000000',

  // Canvas background
  CANVAS_BG: '#F5F5F5',

  // Message banner
  MESSAGE_BG: '#E0F2F1',
  MESSAGE_BORDER: '#00897B',
};
