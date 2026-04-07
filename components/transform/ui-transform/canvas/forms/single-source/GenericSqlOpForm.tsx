// components/transform/canvas/forms/GenericSqlOpForm.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { toastError } from '@/lib/toast';
import { FormActions } from '../shared/FormActions';
import { useOperationForm } from '../shared/useOperationForm';
import { GENERIC_SQL_OP } from '@/constants/transform';
import { getTypedConfig } from '@/types/transform';
import type { OperationFormProps } from '@/types/transform';

interface FormValues {
  sql_statement_1: string;
  sql_statement_2: string;
}

/**
 * Form for writing custom SQL SELECT statements.
 * Splits query into SELECT clause and additional clauses (WHERE, ORDER BY, etc.).
 */
export function GenericSqlOpForm({
  node,
  operation,
  continueOperationChain,
  clearAndClosePanel,
  action,
  setLoading,
}: OperationFormProps) {
  // Uses hook for mode flags and submit; computes source_columns in payload
  const { isViewMode, isEditMode, isSubmitting, submitOperation } = useOperationForm({
    node,
    action,
    operation,
    opType: GENERIC_SQL_OP,
    continueOperationChain,
    setLoading,
  });

  const [inputTableName] = useState<string>(() => {
    if (node?.data?.dbtmodel?.name) return node.data.dbtmodel.name;
    if (node?.data?.name) return node.data.name;
    return 'chained_input';
  });

  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: (() => {
      if ((isEditMode || isViewMode) && node?.data?.operation_config?.config) {
        const config = getTypedConfig(GENERIC_SQL_OP, node.data.operation_config);
        if (config) {
          return {
            sql_statement_1: config.sql_statement_1 || '',
            sql_statement_2: config.sql_statement_2 || '',
          };
        }
      }
      return { sql_statement_1: '', sql_statement_2: '' };
    })(),
  });

  const onSubmit = async (data: FormValues) => {
    if (!data.sql_statement_1.trim()) {
      toastError.api('SELECT statement is required');
      return;
    }

    // Compute source_columns based on mode (respecting isDummy like the original)
    const sourceColumns = (() => {
      const isActualEdit = !node?.data?.isDummy && isEditMode;
      if (isActualEdit && node?.data?.operation_config?.config) {
        const config = getTypedConfig(GENERIC_SQL_OP, node.data.operation_config);
        return config?.source_columns || [];
      }
      return node?.data?.output_columns || [];
    })();

    await submitOperation(
      {
        op_type: GENERIC_SQL_OP,
        config: {
          columns: [],
          sql_statement_1: data.sql_statement_1,
          sql_statement_2: data.sql_statement_2,
        },
        source_columns: sourceColumns,
      },
      'SQL operation saved successfully'
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      {/* SELECT Statement */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="font-semibold">SELECT</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Enter the columns to select. Do not include the SELECT keyword.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Textarea
          {...register('sql_statement_1', { required: 'SELECT statement is required' })}
          placeholder="column_a, column_b, column_a + column_b AS total"
          rows={4}
          disabled={isViewMode}
          data-testid="sql-select-statement"
          className={errors.sql_statement_1 ? 'border-destructive' : ''}
        />
        {errors.sql_statement_1 && (
          <p className="text-sm text-destructive">{errors.sql_statement_1.message}</p>
        )}
      </div>

      {/* FROM + Additional Clauses */}
      <div className="space-y-2">
        <Label className="font-semibold">
          FROM <span className="text-muted-foreground font-mono">{inputTableName}</span>
        </Label>
        <Textarea
          {...register('sql_statement_2')}
          placeholder="WHERE active = true ORDER BY created_at DESC"
          rows={4}
          disabled={isViewMode}
          data-testid="sql-additional-clauses"
        />
        <p className="text-xs text-muted-foreground">
          Additional clauses (WHERE, ORDER BY, LIMIT, etc.)
        </p>
      </div>

      {/* Preview */}
      <div className="p-3 bg-muted rounded-md">
        <Label className="text-xs font-medium text-muted-foreground uppercase mb-2 block">
          Query Preview
        </Label>
        <code className="text-xs font-mono whitespace-pre-wrap break-all">
          SELECT ...{'\n'}
          FROM {inputTableName}
          {'\n'}
          ...
        </code>
      </div>

      {/* Actions */}
      <FormActions
        isViewMode={isViewMode}
        isSubmitting={isSubmitting}
        onCancel={clearAndClosePanel}
      />
    </form>
  );
}
