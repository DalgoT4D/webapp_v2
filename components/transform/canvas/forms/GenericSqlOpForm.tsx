// components/transform/canvas/forms/GenericSqlOpForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { FormActions } from './shared/FormActions';
import type { OperationFormProps, GenericSqlDataConfig, ModelSrcOtherInputPayload } from '@/types/transform';

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
  const isViewMode = action === 'view';
  const isEditMode = action === 'edit';

  const [inputTableName, setInputTableName] = useState('input_table');
  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

  const {
    handleSubmit,
    reset,
    register,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      sql_statement_1: '',
      sql_statement_2: '',
    },
  });

  // Determine input table name from node
  useEffect(() => {
    if (node?.data?.dbtmodel?.name) {
      setInputTableName(node.data.dbtmodel.name);
    } else if (node?.data?.name) {
      setInputTableName(node.data.name);
    } else {
      setInputTableName('chained_input');
    }
  }, [node]);

  // Load existing config in edit mode
  useEffect(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config) {
      const config = node.data.operation_config.config as unknown as GenericSqlDataConfig;
      if (config) {
        reset({
          sql_statement_1: config.sql_statement_1 || '',
          sql_statement_2: config.sql_statement_2 || '',
        });
      }
    }
  }, [isEditMode, isViewMode, node, reset]);

  const onSubmit = async (data: FormValues) => {
    if (!node?.id) {
      toastError.api('No node selected');
      return;
    }

    if (!data.sql_statement_1.trim()) {
      toastError.api('SELECT statement is required');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        op_type: operation.slug,
        config: {
          sql_statement_1: data.sql_statement_1,
          sql_statement_2: data.sql_statement_2,
        },
        source_columns: [] as string[],
        other_inputs: [] as ModelSrcOtherInputPayload[],
      };

      const finalAction = node.data?.isDummy ? 'create' : action;
      let createdNodeUuid: string | undefined;
      if (finalAction === 'edit') {
        await editOperation(node.id, payload);
      } else {
        const response = await createOperation(node.id, {
          ...payload,
          input_node_uuid: node.id,
        });
        createdNodeUuid = response?.uuid;
      }

      toastSuccess.generic('SQL operation saved successfully');
      continueOperationChain(createdNodeUuid);
    } catch (error) {
      console.error('Failed to save SQL operation:', error);
      toastError.save(error, 'operation');
    } finally {
      setLoading(false);
    }
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
        isSubmitting={isCreating || isEditing}
        onCancel={clearAndClosePanel}
      />
    </form>
  );
}
