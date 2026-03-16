// components/transform/canvas/forms/UnpivotOpForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Search } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { FormActions } from './shared/FormActions';
import type {
  OperationFormProps,
  UnpivotDataConfig,
  ModelSrcOtherInputPayload,
} from '@/types/transform';

interface UnpivotColumn {
  col: string;
  is_unpivot_checked: boolean;
  is_exclude_checked: boolean;
}

interface FormValues {
  unpivot_field_name: string;
  unpivot_value_name: string;
  unpivot_columns: UnpivotColumn[];
}

/**
 * Form for unpivoting (melting) data - converting columns into row values.
 * Supports selecting columns to unpivot and columns to keep in output.
 */
export function UnpivotOpForm({
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
  const [searchUnpivot, setSearchUnpivot] = useState('');
  const [searchExclude, setSearchExclude] = useState('');
  const [selectAllCheckbox, setSelectAllCheckbox] = useState({
    is_unpivot: false,
    is_exclude: false,
  });
  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    register,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      unpivot_field_name: 'col_name',
      unpivot_value_name: 'value',
      unpivot_columns: [],
    },
  });

  const { fields: unpivotColFields, replace: unpivotColReplace } = useFieldArray({
    control,
    name: 'unpivot_columns',
  });

  const watchedUnpivotColumns = watch('unpivot_columns');

  // Fetch source columns from node
  useEffect(() => {
    if (node?.data?.output_columns) {
      const sorted = node.data.output_columns.sort((a: string, b: string) => a.localeCompare(b));
      setSrcColumns(sorted);
      const colFields = sorted.map((col: string) => ({
        col,
        is_unpivot_checked: false,
        is_exclude_checked: false,
      }));
      setValue('unpivot_columns', colFields);
    }
  }, [node, setValue]);

  // Load existing config in edit mode
  useEffect(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config) {
      const config = node.data.operation_config.config as unknown as UnpivotDataConfig;
      if (config) {
        const sorted = (config.source_columns || []).sort((a, b) => a.localeCompare(b));
        setSrcColumns(sorted);

        const colFields = sorted.map((col) => ({
          col,
          is_unpivot_checked: config.unpivot_columns?.includes(col) || false,
          is_exclude_checked: config.exclude_columns?.includes(col) || false,
        }));

        reset({
          unpivot_field_name: config.unpivot_field_name || 'col_name',
          unpivot_value_name: config.unpivot_value_name || 'value',
          unpivot_columns: colFields,
        });
      }
    }
  }, [isEditMode, isViewMode, node, reset]);

  // Update select all checkbox state
  useEffect(() => {
    if (watchedUnpivotColumns.length > 0) {
      const allUnpivot = watchedUnpivotColumns.every((f) => f.is_unpivot_checked);
      const allExclude = watchedUnpivotColumns.every((f) => f.is_exclude_checked);
      setSelectAllCheckbox({ is_unpivot: allUnpivot, is_exclude: allExclude });
    }
  }, [watchedUnpivotColumns]);

  // Filtered columns based on search
  const filteredUnpivotColumns = watchedUnpivotColumns.filter((c) =>
    c.col.toLowerCase().includes(searchUnpivot.toLowerCase())
  );
  const filteredExcludeColumns = watchedUnpivotColumns.filter((c) =>
    c.col.toLowerCase().includes(searchExclude.toLowerCase())
  );

  // Handle checkbox update - mutually exclusive
  const handleUnpivotColUpdate = (checked: boolean, columnName: string, isExclude: boolean) => {
    const updatedFields = watchedUnpivotColumns.map((field) => {
      if (field.col === columnName) {
        return {
          ...field,
          is_unpivot_checked: isExclude ? (checked ? false : field.is_unpivot_checked) : checked,
          is_exclude_checked: isExclude ? checked : checked ? false : field.is_exclude_checked,
        };
      }
      return field;
    });
    unpivotColReplace(updatedFields);
  };

  // Select all handler
  const handleSelectAll = (checked: boolean, isExclude: boolean) => {
    const updatedFields = watchedUnpivotColumns.map((field) => ({
      col: field.col,
      is_unpivot_checked: isExclude ? false : checked,
      is_exclude_checked: isExclude ? checked : false,
    }));
    unpivotColReplace(updatedFields);
    setSelectAllCheckbox({
      is_unpivot: isExclude ? false : checked,
      is_exclude: isExclude ? checked : false,
    });
  };

  const onSubmit = async (data: FormValues) => {
    if (!node?.id) {
      toastError.api('No node selected');
      return;
    }

    const unpivotCols = data.unpivot_columns.filter((c) => c.is_unpivot_checked).map((c) => c.col);

    if (unpivotCols.length === 0) {
      setError('unpivot_columns', {
        type: 'manual',
        message: 'At least one column is required to unpivot',
      });
      toastError.api('At least one column is required to unpivot');
      return;
    }

    const excludeCols = data.unpivot_columns.filter((c) => c.is_exclude_checked).map((c) => c.col);

    setLoading(true);

    try {
      const payload = {
        op_type: operation.slug,
        config: {
          unpivot_columns: unpivotCols,
          unpivot_field_name: data.unpivot_field_name,
          unpivot_value_name: data.unpivot_value_name,
          exclude_columns: excludeCols,
        },
        source_columns: srcColumns,
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

      toastSuccess.generic('Unpivot operation saved successfully');
      continueOperationChain(createdNodeUuid);
    } catch (error) {
      console.error('Failed to save unpivot operation:', error);
      toastError.save(error, 'operation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      {/* Search Unpivot */}
      <div className="relative">
        <Input
          placeholder="Search columns to unpivot"
          value={searchUnpivot}
          onChange={(e) => setSearchUnpivot(e.target.value)}
          className="pr-10"
          data-testid="unpivot-search-unpivot"
        />
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      </div>

      {/* Unpivot Columns Table */}
      <div className="border rounded-md">
        <div className="bg-muted px-4 py-3 rounded-t-md">
          <Label className="text-xs font-medium text-muted-foreground uppercase">
            Columns to unpivot
          </Label>
        </div>
        {/* Select All */}
        <div className="flex items-center gap-2 px-4 py-2 border-b">
          <Checkbox
            checked={selectAllCheckbox.is_unpivot}
            onCheckedChange={(checked) => handleSelectAll(!!checked, false)}
            disabled={isViewMode}
            data-testid="unpivot-select-all-unpivot"
          />
          <span className="font-semibold text-sm">Select all</span>
        </div>
        {/* Column List */}
        <div className="max-h-48 overflow-y-auto divide-y">
          {filteredUnpivotColumns.map((field, idx) => (
            <div key={field.col} className="flex items-center gap-2 px-4 py-2">
              <Checkbox
                disabled={isViewMode}
                checked={field.is_unpivot_checked}
                onCheckedChange={(checked) => handleUnpivotColUpdate(!!checked, field.col, false)}
                data-testid={`unpivot-col-${idx}`}
              />
              <span className="text-sm font-medium">{field.col}</span>
            </div>
          ))}
        </div>
      </div>

      {errors.unpivot_columns?.message && (
        <p className="text-sm text-destructive">{errors.unpivot_columns.message}</p>
      )}

      {/* Search Exclude */}
      <div className="relative">
        <Input
          placeholder="Search columns to keep in output"
          value={searchExclude}
          onChange={(e) => setSearchExclude(e.target.value)}
          className="pr-10"
          data-testid="unpivot-search-exclude"
        />
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      </div>

      {/* Exclude Columns Table */}
      <div className="border rounded-md">
        <div className="bg-muted px-4 py-3 rounded-t-md">
          <Label className="text-xs font-medium text-muted-foreground uppercase">
            Columns to keep in output table
          </Label>
        </div>
        {/* Select All */}
        <div className="flex items-center gap-2 px-4 py-2 border-b">
          <Checkbox
            checked={selectAllCheckbox.is_exclude}
            onCheckedChange={(checked) => handleSelectAll(!!checked, true)}
            disabled={isViewMode}
            data-testid="unpivot-select-all-exclude"
          />
          <span className="font-semibold text-sm">Select all</span>
        </div>
        {/* Column List */}
        <div className="max-h-48 overflow-y-auto divide-y">
          {filteredExcludeColumns.map((field, idx) => (
            <div key={field.col} className="flex items-center gap-2 px-4 py-2">
              <Checkbox
                disabled={isViewMode}
                checked={field.is_exclude_checked}
                onCheckedChange={(checked) => handleUnpivotColUpdate(!!checked, field.col, true)}
                data-testid={`unpivot-exclude-${idx}`}
              />
              <span className="text-sm font-medium">{field.col}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Output Field Names */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Column Name Field</Label>
          <Input
            {...register('unpivot_field_name')}
            placeholder="col_name"
            disabled={isViewMode}
            data-testid="unpivot-field-name"
          />
        </div>
        <div className="space-y-2">
          <Label>Value Field</Label>
          <Input
            {...register('unpivot_value_name')}
            placeholder="value"
            disabled={isViewMode}
            data-testid="unpivot-value-name"
          />
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
