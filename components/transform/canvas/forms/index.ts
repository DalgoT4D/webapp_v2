// components/transform/canvas/forms/index.ts
import type { ComponentType } from 'react';
import type { OperationFormProps } from '@/types/transform';

// Import all operation forms
import { RenameColumnOpForm } from './RenameColumnOpForm';
import { DropColumnOpForm } from './DropColumnOpForm';
import { CastColumnOpForm } from './CastColumnOpForm';
import { ReplaceValueOpForm } from './ReplaceValueOpForm';
import { AggregationOpForm } from './AggregationOpForm';
import { GroupByOpForm } from './GroupByOpForm';
import { ArithmeticOpForm } from './ArithmeticOpForm';
import { JoinOpForm } from './JoinOpForm';
import { UnionTablesOpForm } from './UnionTablesOpForm';
import { CoalesceOpForm } from './CoalesceOpForm';
import { CaseWhenOpForm } from './CaseWhenOpForm';
import { WhereFilterOpForm } from './WhereFilterOpForm';
import { PivotOpForm } from './PivotOpForm';
import { UnpivotOpForm } from './UnpivotOpForm';
import { FlattenJsonOpForm } from './FlattenJsonOpForm';
import { CreateTableForm } from './CreateTableForm';
import { GenericColumnOpForm } from './GenericColumnOpForm';
import { GenericSqlOpForm } from './GenericSqlOpForm';

// Import operation slug constants
import {
  RENAME_COLUMNS_OP,
  DROP_COLUMNS_OP,
  CAST_DATA_TYPES_OP,
  REPLACE_COLUMN_VALUE_OP,
  AGGREGATE_OP,
  GROUPBY_OP,
  ARITHMETIC_OP,
  JOIN_OP,
  UNION_OP,
  COALESCE_COLUMNS_OP,
  CASEWHEN_OP,
  WHERE_OP,
  PIVOT_OP,
  UNPIVOT_OP,
  FLATTEN_JSON_OP,
  GENERIC_COL_OP,
  GENERIC_SQL_OP,
} from '@/constants/transform';

// Export all forms
export { RenameColumnOpForm } from './RenameColumnOpForm';
export { DropColumnOpForm } from './DropColumnOpForm';
export { CastColumnOpForm } from './CastColumnOpForm';
export { ReplaceValueOpForm } from './ReplaceValueOpForm';
export { AggregationOpForm } from './AggregationOpForm';
export { GroupByOpForm } from './GroupByOpForm';
export { ArithmeticOpForm } from './ArithmeticOpForm';
export { JoinOpForm } from './JoinOpForm';
export { UnionTablesOpForm } from './UnionTablesOpForm';
export { CoalesceOpForm } from './CoalesceOpForm';
export { CaseWhenOpForm } from './CaseWhenOpForm';
export { WhereFilterOpForm } from './WhereFilterOpForm';
export { PivotOpForm } from './PivotOpForm';
export { UnpivotOpForm } from './UnpivotOpForm';
export { FlattenJsonOpForm } from './FlattenJsonOpForm';
export { CreateTableForm } from './CreateTableForm';
export { GenericColumnOpForm } from './GenericColumnOpForm';
export { GenericSqlOpForm } from './GenericSqlOpForm';

// Export shared components
export { ColumnSelect } from './shared/ColumnSelect';
export { FormActions } from './shared/FormActions';
export { OperandInput } from './shared/OperandInput';

/**
 * Form registry mapping operation slugs to form components.
 * Used by OperationConfigLayout to render the correct form.
 */
export const FORM_REGISTRY: Record<string, ComponentType<OperationFormProps>> = {
  [RENAME_COLUMNS_OP]: RenameColumnOpForm,
  [DROP_COLUMNS_OP]: DropColumnOpForm,
  [CAST_DATA_TYPES_OP]: CastColumnOpForm,
  [REPLACE_COLUMN_VALUE_OP]: ReplaceValueOpForm,
  [AGGREGATE_OP]: AggregationOpForm,
  [GROUPBY_OP]: GroupByOpForm,
  [ARITHMETIC_OP]: ArithmeticOpForm,
  [JOIN_OP]: JoinOpForm,
  [UNION_OP]: UnionTablesOpForm,
  [COALESCE_COLUMNS_OP]: CoalesceOpForm,
  [CASEWHEN_OP]: CaseWhenOpForm,
  [WHERE_OP]: WhereFilterOpForm,
  [PIVOT_OP]: PivotOpForm,
  [UNPIVOT_OP]: UnpivotOpForm,
  [FLATTEN_JSON_OP]: FlattenJsonOpForm,
  [GENERIC_COL_OP]: GenericColumnOpForm,
  [GENERIC_SQL_OP]: GenericSqlOpForm,
  'create-table': CreateTableForm,
};

/**
 * Get the form component for an operation slug.
 * Returns null if no form is registered for the slug.
 */
export function getFormForOperation(slug: string): ComponentType<OperationFormProps> | null {
  return FORM_REGISTRY[slug] || null;
}
