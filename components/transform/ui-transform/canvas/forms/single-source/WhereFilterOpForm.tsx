// components/transform/canvas/forms/WhereFilterOpForm.tsx
'use client';

import { useForm, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { toastError } from '@/lib/toast';
import { ColumnSelect } from '../shared/ColumnSelect';
import { FormActions } from '../shared/FormActions';
import { useOperationForm } from '../shared/useOperationForm';
import { parseStringForNull } from '../shared/utils';
import { LogicalOperators, WhereFilterType } from '@/constants/transform';
import type { OperationFormProps, WherefilterDataConfig } from '@/types/transform';

interface FormValues {
  filterCol: string;
  logicalOp: string;
  operandType: 'col' | 'val';
  operandColVal: string;
  operandConstVal: string;
  advanceFilter: boolean;
  sql_snippet: string;
}

/**
 * Form for filtering rows using WHERE conditions.
 * Supports both simple mode (UI-based) and advance mode (raw SQL).
 */
export function WhereFilterOpForm({
  node,
  operation,
  continueOperationChain,
  clearAndClosePanel,
  action,
  setLoading,
}: OperationFormProps) {
  const { isViewMode, isEditMode, srcColumns, isSubmitting, submitOperation } = useOperationForm({
    node,
    action,
    operation,
    continueOperationChain,
    setLoading,
    sortColumns: true,
  });

  const { control, handleSubmit, watch, setValue, register } = useForm<FormValues>({
    defaultValues: (() => {
      if ((isEditMode || isViewMode) && node?.data?.operation_config?.config) {
        const config = node.data.operation_config.config as unknown as WherefilterDataConfig;
        if (config) {
          const isAdvance = config.where_type === WhereFilterType.SQL;
          let clauseValues: Partial<FormValues> = {};
          if (config.clauses && config.clauses.length > 0) {
            const clause = config.clauses[0];
            clauseValues = {
              filterCol: clause.column,
              logicalOp: clause.operator,
              operandType: clause.operand?.is_col ? 'col' : 'val',
              operandColVal: clause.operand?.is_col ? clause.operand.value : '',
              operandConstVal: clause.operand?.is_col ? '' : clause.operand?.value || '',
            };
          }
          return {
            filterCol: '',
            logicalOp: '',
            operandType: 'val' as const,
            operandColVal: '',
            operandConstVal: '',
            ...clauseValues,
            advanceFilter: isAdvance,
            sql_snippet: config.sql_snippet || '',
          };
        }
      }
      return {
        filterCol: '',
        logicalOp: '',
        operandType: 'val' as const,
        operandColVal: '',
        operandConstVal: '',
        advanceFilter: false,
        sql_snippet: '',
      };
    })(),
  });

  const advanceFilter = watch('advanceFilter');
  const operandType = watch('operandType');
  const logicalOp = watch('logicalOp');
  const isNullOperator = logicalOp === 'IS NULL' || logicalOp === 'IS NOT NULL';

  // Filter out 'between' - only used in CaseWhen
  const filteredOperators = LogicalOperators.filter((op) => op.id !== 'between');

  const onSubmit = async (data: FormValues) => {
    if (!data.advanceFilter) {
      if (!data.filterCol || !data.logicalOp) {
        toastError.api('Column and operation are required');
        return;
      }
    } else {
      if (!data.sql_snippet) {
        toastError.api('SQL snippet is required for advance filter');
        return;
      }
    }

    await submitOperation(
      {
        op_type: operation.slug,
        config: {
          where_type: data.advanceFilter ? WhereFilterType.SQL : WhereFilterType.AND,
          clauses: data.advanceFilter
            ? []
            : [
                {
                  column: data.filterCol,
                  operator: data.logicalOp,
                  operand:
                    data.logicalOp === 'IS NULL' || data.logicalOp === 'IS NOT NULL'
                      ? null
                      : {
                          value:
                            data.operandType === 'col'
                              ? data.operandColVal
                              : parseStringForNull(data.operandConstVal),
                          is_col: data.operandType === 'col',
                        },
                },
              ],
          sql_snippet: data.sql_snippet,
        },
        source_columns: srcColumns,
      },
      'Filter operation saved successfully'
    );
  };

  const isSimpleFieldsDisabled = advanceFilter || isViewMode;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      {/* Column Select */}
      <div className="space-y-2">
        <Label>Select Column *</Label>
        <ColumnSelect
          value={watch('filterCol')}
          onChange={(value) => setValue('filterCol', value)}
          columns={srcColumns}
          placeholder="Select column to filter"
          disabled={isSimpleFieldsDisabled}
          testId="where-filter-col"
        />
      </div>

      {/* Operation Select */}
      <div className="space-y-2">
        <Label>Select Operation *</Label>
        <Controller
          control={control}
          name="logicalOp"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={isSimpleFieldsDisabled}
            >
              <SelectTrigger data-testid="where-operation-select">
                <SelectValue placeholder="Select operation" />
              </SelectTrigger>
              <SelectContent>
                {filteredOperators.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Operand Type - hidden for IS NULL / IS NOT NULL */}
      {!isNullOperator && (
        <>
          <Controller
            control={control}
            name="operandType"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="flex gap-4"
                disabled={isSimpleFieldsDisabled}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="col" id="operand-col" />
                  <Label htmlFor="operand-col" className="text-sm">
                    Column
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="val" id="operand-val" />
                  <Label htmlFor="operand-val" className="text-sm">
                    Value
                  </Label>
                </div>
              </RadioGroup>
            )}
          />

          {/* Operand Value */}
          {operandType === 'col' ? (
            <ColumnSelect
              value={watch('operandColVal')}
              onChange={(value) => setValue('operandColVal', value)}
              columns={srcColumns}
              placeholder="Select comparison column"
              disabled={isSimpleFieldsDisabled}
              testId="where-operand-col"
            />
          ) : (
            <Input
              {...register('operandConstVal')}
              placeholder="Enter the value"
              disabled={isSimpleFieldsDisabled}
              data-testid="where-operand-val"
            />
          )}
        </>
      )}

      {/* Advance Filter Toggle */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <Label className="font-semibold">Advance Filter</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Enter the SQL WHERE clause directly</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Controller
          control={control}
          name="advanceFilter"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isViewMode} />
          )}
        />
      </div>

      {/* SQL Snippet */}
      {advanceFilter && (
        <div className="space-y-2">
          <Label>WHERE Clause</Label>
          <Textarea
            {...register('sql_snippet')}
            placeholder="Enter the WHERE clause (without WHERE keyword)"
            rows={4}
            disabled={isViewMode}
            data-testid="where-sql-snippet"
          />
        </div>
      )}

      {/* Actions */}
      <FormActions
        isViewMode={isViewMode}
        isSubmitting={isSubmitting}
        onCancel={clearAndClosePanel}
      />
    </form>
  );
}
