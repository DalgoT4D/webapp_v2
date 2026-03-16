// components/transform/canvas/forms/PivotOpForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Search } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { ColumnSelect } from './shared/ColumnSelect';
import { FormActions } from './shared/FormActions';
import type { OperationFormProps, PivotDataConfig } from '@/types/transform';

interface PivotValueItem {
  col: string;
}

interface GroupbyColumn {
  col: string;
  is_checked: boolean;
}

interface FormValues {
  pivot_column_name: string;
  pivot_column_values: PivotValueItem[];
  groupby_columns: GroupbyColumn[];
}

/**
 * Form for pivoting (transposing) data - converting row values into columns.
 * Supports pivot column selection, pivot values, and groupby columns.
 */
export function PivotOpForm({
  node,
  operation,
  continueOperationChain,
  clearAndClosePanel,
  action,
  setLoading,
}: OperationFormProps) {
  const isViewMode = action === 'view';
  const isEditMode = action === 'edit';

  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectAllCheckbox, setSelectAllCheckbox] = useState(false);
  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

  const { control, handleSubmit, reset, watch, setValue, register } = useForm<FormValues>({
    defaultValues: {
      pivot_column_name: '',
      pivot_column_values: [{ col: '' }],
      groupby_columns: [],
    },
  });

  const pivotColumn = watch('pivot_column_name');
  const watchedGroupbyColumns = watch('groupby_columns');

  const {
    fields: pivotValueFields,
    append: appendPivotValue,
    remove: removePivotValue,
  } = useFieldArray({
    control,
    name: 'pivot_column_values',
  });

  const {
    fields: groupbyFields,
    replace: replaceGroupby,
    update: updateGroupby,
  } = useFieldArray({
    control,
    name: 'groupby_columns',
  });

  // Fetch source columns from node
  useEffect(() => {
    if (node?.data?.output_columns) {
      const sorted = node.data.output_columns.sort((a: string, b: string) => a.localeCompare(b));
      setSrcColumns(sorted);
      const colData = sorted.map((col: string) => ({ col, is_checked: false }));
      setValue('groupby_columns', colData);
    }
  }, [node, setValue]);

  // Load existing config in edit mode
  useEffect(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config) {
      const config = node.data.operation_config.config as PivotDataConfig;
      if (config) {
        const sorted = (config.source_columns || []).sort((a, b) => a.localeCompare(b));
        setSrcColumns(sorted);

        const groupbyColumns = sorted.map((col) => ({
          col,
          is_checked: config.groupby_columns?.includes(col) || false,
        }));

        reset({
          pivot_column_name: config.pivot_column_name || '',
          pivot_column_values: [
            ...(config.pivot_column_values?.map((v) => ({ col: v })) || []),
            { col: '' },
          ],
          groupby_columns: groupbyColumns,
        });
      }
    }
  }, [isEditMode, isViewMode, node, reset]);

  // Update select all checkbox state
  useEffect(() => {
    if (watchedGroupbyColumns.length > 0) {
      const filteredCols = watchedGroupbyColumns.filter((c) => c.col !== pivotColumn);
      const allChecked = filteredCols.every((f) => f.is_checked);
      setSelectAllCheckbox(allChecked);
    }
  }, [watchedGroupbyColumns, pivotColumn]);

  // Filter columns for display based on search
  const filteredGroupbyColumns = watchedGroupbyColumns.filter((col) =>
    col.col.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    const updatedFields = watchedGroupbyColumns.map((field) => ({
      col: field.col,
      is_checked: field.col === pivotColumn ? false : checked,
    }));
    replaceGroupby(updatedFields);
    setSelectAllCheckbox(checked);
  };

  // Handle single checkbox update
  const handleGroupbyUpdate = (checked: boolean, columnName: string) => {
    const index = watchedGroupbyColumns.findIndex((f) => f.col === columnName);
    if (index >= 0) {
      updateGroupby(index, { col: columnName, is_checked: checked });
    }
  };

  // Handle pivot column change - uncheck it from groupby
  const handlePivotColumnChange = (value: string) => {
    setValue('pivot_column_name', value);
    if (value) {
      const index = watchedGroupbyColumns.findIndex((f) => f.col === value);
      if (index >= 0) {
        updateGroupby(index, { col: value, is_checked: false });
      }
    }
  };

  // Handle Enter key in pivot value input
  const handlePivotValueKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === pivotValueFields.length - 1) {
        appendPivotValue({ col: '' });
      }
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!node?.id) {
      toastError.api('No node selected');
      return;
    }

    if (!data.pivot_column_name) {
      toastError.api('Pivot column is required');
      return;
    }

    const validPivotValues = data.pivot_column_values.filter((v) => v.col.trim()).map((v) => v.col);

    if (validPivotValues.length === 0) {
      toastError.api('At least one pivot value is required');
      return;
    }

    const groupbyColumns = data.groupby_columns.filter((c) => c.is_checked).map((c) => c.col);

    setLoading(true);

    try {
      const payload = {
        op_type: operation.slug,
        config: {
          pivot_column_name: data.pivot_column_name,
          pivot_column_values: validPivotValues,
          groupby_columns: groupbyColumns,
        },
        source_columns: srcColumns,
        other_inputs: [],
      };

      const finalAction = node.data?.isDummy ? 'create' : action;
      if (finalAction === 'edit') {
        await editOperation(node.id, payload);
      } else {
        await createOperation(node.id, {
          ...payload,
          input_node_uuid: node.id,
        });
      }

      toastSuccess.generic('Pivot operation saved successfully');
      continueOperationChain();
    } catch (error) {
      console.error('Failed to save pivot operation:', error);
      toastError.save(error, 'operation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault();
      }}
      className="p-6 space-y-4"
    >
      {/* Pivot Column Select */}
      <div className="space-y-2">
        <Label>Select Column to pivot on *</Label>
        <ColumnSelect
          value={pivotColumn}
          onChange={handlePivotColumnChange}
          columns={srcColumns}
          placeholder="Select pivot column"
          disabled={isViewMode}
          testId="pivot-column-select"
        />
      </div>

      {/* Pivot Values Table */}
      <div className="border rounded-md">
        <div className="bg-muted px-4 py-3 rounded-t-md">
          <Label className="text-xs font-medium text-muted-foreground uppercase">
            Column values to pivot on
          </Label>
        </div>
        <div className="divide-y max-h-48 overflow-y-auto">
          {pivotValueFields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-3 px-4 py-3">
              <Input
                {...register(`pivot_column_values.${index}.col`)}
                placeholder="Enter value"
                disabled={isViewMode}
                onKeyDown={(e) => handlePivotValueKeyDown(e, index)}
                data-testid={`pivot-value-${index}`}
              />
              {pivotValueFields.length > 1 && !isViewMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePivotValue(index)}
                  className="h-9 w-9"
                  data-testid={`pivot-value-remove-${index}`}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add Pivot Value Button */}
      {!isViewMode && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => appendPivotValue({ col: '' })}
          data-testid="pivot-add-value"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add row
        </Button>
      )}

      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search by column name"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
          data-testid="pivot-search"
        />
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      </div>

      {/* Groupby Columns Table */}
      <div className="border rounded-md">
        <div className="bg-muted px-4 py-3 rounded-t-md">
          <Label className="text-xs font-medium text-muted-foreground uppercase">
            Columns to groupby
          </Label>
        </div>
        {/* Select All */}
        <div className="flex items-center gap-2 px-4 py-2 border-b">
          <Checkbox
            checked={selectAllCheckbox}
            onCheckedChange={(checked) => handleSelectAll(!!checked)}
            disabled={isViewMode}
            data-testid="pivot-select-all"
          />
          <span className="font-semibold text-sm">Select all</span>
        </div>
        {/* Column List */}
        <div className="max-h-48 overflow-y-auto divide-y">
          {filteredGroupbyColumns.map((field) => (
            <div key={field.col} className="flex items-center gap-2 px-4 py-2">
              <Checkbox
                disabled={field.col === pivotColumn || isViewMode}
                checked={field.is_checked}
                onCheckedChange={(checked) => handleGroupbyUpdate(!!checked, field.col)}
                data-testid={`pivot-groupby-${field.col}`}
              />
              <span className="text-sm font-medium">{field.col}</span>
              {field.col === pivotColumn && (
                <span className="text-xs text-muted-foreground">(pivot column)</span>
              )}
            </div>
          ))}
        </div>
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
