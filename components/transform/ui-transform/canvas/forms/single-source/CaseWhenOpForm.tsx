// components/transform/canvas/forms/CaseWhenOpForm.tsx
'use client';

import { useForm, useFieldArray, Controller, type Control, type FieldPath } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { Plus, Trash2, Info } from 'lucide-react';
import { toastError } from '@/lib/toast';
import { ColumnSelect } from '../shared/ColumnSelect';
import { FormActions } from '../shared/FormActions';
import { useOperationForm } from '../shared/useOperationForm';
import { parseStringForNull } from '../shared/utils';
import { LogicalOperators, CaseWhenType, CASEWHEN_OP } from '@/constants/transform';
import { getTypedConfig } from '@/types/transform';
import type { OperationFormProps, WhenClause } from '@/types/transform';

interface OperandValue {
  type: 'col' | 'val';
  col_val: string;
  const_val: string;
}

interface CaseClause {
  filterCol: string;
  logicalOp: string;
  operand1: OperandValue;
  operand2: OperandValue; // For 'between' operator
  then: OperandValue;
}

interface FormValues {
  clauses: CaseClause[];
  elseValue: OperandValue;
  output_column_name: string;
  advanceFilter: boolean;
  sql_snippet: string;
}

const defaultOperand: OperandValue = { type: 'val', col_val: '', const_val: '' };

/** Extracted outside form to prevent remount on every render (which causes input focus loss) */
function CaseOperandInput({
  name,
  operandValue,
  disabled,
  testIdPrefix,
  control,
  columns,
}: {
  name: string;
  operandValue: OperandValue;
  disabled: boolean;
  testIdPrefix: string;
  control: Control<FormValues>;
  columns: string[];
}) {
  return (
    <div className="space-y-2">
      <Controller
        control={control}
        name={`${name}.type` as FieldPath<FormValues>}
        render={({ field }) => (
          <RadioGroup
            value={field.value as string}
            onValueChange={field.onChange}
            className="flex gap-4"
            disabled={disabled}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="col" id={`${testIdPrefix}-col`} />
              <Label htmlFor={`${testIdPrefix}-col`} className="text-sm">
                Column
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="val" id={`${testIdPrefix}-val`} />
              <Label htmlFor={`${testIdPrefix}-val`} className="text-sm">
                Value
              </Label>
            </div>
          </RadioGroup>
        )}
      />
      {operandValue?.type === 'col' ? (
        <Controller
          control={control}
          name={`${name}.col_val` as FieldPath<FormValues>}
          render={({ field }) => (
            <ColumnSelect
              value={field.value as string}
              onChange={field.onChange}
              columns={columns}
              placeholder="Select column"
              disabled={disabled}
              testId={`${testIdPrefix}-col-select`}
            />
          )}
        />
      ) : (
        <Controller
          control={control}
          name={`${name}.const_val` as FieldPath<FormValues>}
          render={({ field }) => (
            <Input
              {...field}
              value={field.value as string}
              placeholder="Enter value"
              disabled={disabled}
              data-testid={`${testIdPrefix}-val-input`}
            />
          )}
        />
      )}
    </div>
  );
}

const defaultClause: CaseClause = {
  filterCol: '',
  logicalOp: '',
  operand1: { ...defaultOperand },
  operand2: { ...defaultOperand },
  then: { ...defaultOperand },
};

/**
 * Form for creating CASE WHEN conditional logic.
 * Supports multiple when/then clauses with an else clause.
 */
export function CaseWhenOpForm({
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
    opType: CASEWHEN_OP,
    continueOperationChain,
    setLoading,
    sortColumns: true,
  });

  const { control, handleSubmit, watch, setValue, register } = useForm<FormValues>({
    defaultValues: (() => {
      if ((isEditMode || isViewMode) && node?.data?.operation_config?.config) {
        const config = getTypedConfig(CASEWHEN_OP, node.data.operation_config);
        if (config) {
          const isAdvance = config.case_type === CaseWhenType.ADVANCE;

          const clauses: CaseClause[] = config.when_clauses?.map((clause: WhenClause) => ({
            filterCol: clause.column,
            logicalOp: clause.operator,
            operand1: clause.operands[0]
              ? {
                  type: clause.operands[0].is_col ? 'col' : 'val',
                  col_val: clause.operands[0].is_col ? clause.operands[0].value : '',
                  const_val: clause.operands[0].is_col ? '' : clause.operands[0].value,
                }
              : { ...defaultOperand },
            operand2: clause.operands[1]
              ? {
                  type: clause.operands[1].is_col ? 'col' : 'val',
                  col_val: clause.operands[1].is_col ? clause.operands[1].value : '',
                  const_val: clause.operands[1].is_col ? '' : clause.operands[1].value,
                }
              : { ...defaultOperand },
            then: {
              type: clause.then.is_col ? 'col' : 'val',
              col_val: clause.then.is_col ? clause.then.value : '',
              const_val: clause.then.is_col ? '' : clause.then.value,
            },
          })) || [{ ...defaultClause }];

          return {
            clauses,
            elseValue: config.else_clause
              ? {
                  type: config.else_clause.is_col ? 'col' : 'val',
                  col_val: config.else_clause.is_col ? config.else_clause.value : '',
                  const_val: config.else_clause.is_col ? '' : config.else_clause.value,
                }
              : { ...defaultOperand },
            output_column_name: config.output_column_name || '',
            advanceFilter: isAdvance,
            sql_snippet: config.sql_snippet || '',
          };
        }
      }
      return {
        clauses: [{ ...defaultClause }],
        elseValue: { ...defaultOperand },
        output_column_name: '',
        advanceFilter: false,
        sql_snippet: '',
      };
    })(),
  });

  const {
    fields: clauseFields,
    append,
    remove,
  } = useFieldArray({
    control,
    name: 'clauses',
  });

  const advanceFilter = watch('advanceFilter');
  const watchedClauses = watch('clauses');
  const watchedElseValue = watch('elseValue');

  const onSubmit = async (data: FormValues) => {
    if (!data.output_column_name) {
      toastError.api('Output column name is required');
      return;
    }

    if (data.advanceFilter && !data.sql_snippet) {
      toastError.api('SQL snippet is required for advance mode');
      return;
    }

    await submitOperation(
      {
        op_type: CASEWHEN_OP,
        config: {
          case_type: data.advanceFilter ? CaseWhenType.ADVANCE : CaseWhenType.SIMPLE,
          when_clauses: data.advanceFilter
            ? []
            : data.clauses.map((clause) => {
                const isNullOp =
                  clause.logicalOp === 'IS NULL' || clause.logicalOp === 'IS NOT NULL';

                const operands = isNullOp
                  ? []
                  : [
                      {
                        value:
                          clause.operand1.type === 'col'
                            ? clause.operand1.col_val
                            : parseStringForNull(clause.operand1.const_val),
                        is_col: clause.operand1.type === 'col',
                      },
                    ];

                // Add second operand for 'between' operator
                if (clause.logicalOp === 'between') {
                  operands.push({
                    value:
                      clause.operand2.type === 'col'
                        ? clause.operand2.col_val
                        : parseStringForNull(clause.operand2.const_val),
                    is_col: clause.operand2.type === 'col',
                  });
                }

                return {
                  column: clause.filterCol,
                  operator: clause.logicalOp,
                  operands,
                  then: {
                    value:
                      clause.then.type === 'col'
                        ? clause.then.col_val
                        : parseStringForNull(clause.then.const_val),
                    is_col: clause.then.type === 'col',
                  },
                };
              }),
          else_clause: {
            value:
              data.elseValue.type === 'col'
                ? data.elseValue.col_val
                : parseStringForNull(data.elseValue.const_val),
            is_col: data.elseValue.type === 'col',
          },
          sql_snippet: data.sql_snippet,
          output_column_name: data.output_column_name,
        },
        source_columns: srcColumns,
      },
      'Case when operation saved successfully'
    );
  };

  const isSimpleDisabled = advanceFilter || isViewMode;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      {/* Clauses */}
      {clauseFields.map((clauseField, index) => {
        const clause = watchedClauses[index];
        const isBetween = clause?.logicalOp === 'between';
        const isNullOperator =
          clause?.logicalOp === 'IS NULL' || clause?.logicalOp === 'IS NOT NULL';

        return (
          <div key={clauseField.id} className="p-4 border rounded-md space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-muted-foreground">
                CASE {String(index + 1).padStart(2, '0')}
              </Label>
              {clauseFields.length > 1 && !isViewMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  data-testid={`case-remove-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* WHEN */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="font-semibold">When</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Condition to check</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <ColumnSelect
                value={clause?.filterCol || ''}
                onChange={(value) => setValue(`clauses.${index}.filterCol`, value)}
                columns={srcColumns}
                placeholder="Select column to check"
                disabled={isSimpleDisabled}
                testId={`case-when-col-${index}`}
              />

              <Controller
                control={control}
                name={`clauses.${index}.logicalOp`}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSimpleDisabled}
                  >
                    <SelectTrigger data-testid={`case-op-${index}`}>
                      <SelectValue placeholder="Select operation" />
                    </SelectTrigger>
                    <SelectContent>
                      {LogicalOperators.map((op) => (
                        <SelectItem key={op.id} value={op.id}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />

              {!isNullOperator && (
                <CaseOperandInput
                  name={`clauses.${index}.operand1`}
                  operandValue={clause?.operand1}
                  disabled={isSimpleDisabled}
                  testIdPrefix={`case-operand1-${index}`}
                  control={control}
                  columns={srcColumns}
                />
              )}

              {isBetween && (
                <>
                  <Label className="text-sm text-muted-foreground">AND</Label>
                  <CaseOperandInput
                    name={`clauses.${index}.operand2`}
                    operandValue={clause?.operand2}
                    disabled={isSimpleDisabled}
                    testIdPrefix={`case-operand2-${index}`}
                    control={control}
                    columns={srcColumns}
                  />
                </>
              )}
            </div>

            {/* THEN */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="font-semibold">Then</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Output when condition is true</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <CaseOperandInput
                name={`clauses.${index}.then`}
                operandValue={clause?.then}
                disabled={isSimpleDisabled}
                testIdPrefix={`case-then-${index}`}
                control={control}
                columns={srcColumns}
              />
            </div>
          </div>
        );
      })}

      {/* Add Case Button */}
      {!isViewMode && !advanceFilter && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ ...defaultClause })}
          className="w-full"
          data-testid="case-add"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Case {clauseFields.length + 1}
        </Button>
      )}

      {/* ELSE */}
      <div className="p-4 border rounded-md space-y-4">
        <div className="flex items-center gap-2">
          <Label className="font-semibold">Else</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Output if no cases match</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CaseOperandInput
          name="elseValue"
          operandValue={watchedElseValue}
          disabled={isSimpleDisabled}
          testIdPrefix="case-else"
          control={control}
          columns={srcColumns}
        />
      </div>

      {/* Output Column Name */}
      <div className="space-y-2">
        <Label>Output Column Name *</Label>
        <Input
          {...register('output_column_name', { required: true })}
          placeholder="Enter output column name"
          disabled={isViewMode}
          data-testid="case-output-name"
        />
      </div>

      {/* Advance Filter Toggle */}
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <Label className="font-semibold">Advance Mode</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Enter the SQL CASE WHEN statement directly</p>
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
          <Label>SQL CASE Statement</Label>
          <Textarea
            {...register('sql_snippet')}
            placeholder="CASE WHEN status = 'A' THEN 'Active' ELSE 'Unknown' END"
            rows={4}
            disabled={isViewMode}
            data-testid="case-sql-snippet"
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
