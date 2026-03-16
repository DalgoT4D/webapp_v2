// components/transform/canvas/forms/JoinOpForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { toastSuccess, toastError } from '@/lib/toast';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { useCanvasSources } from '@/hooks/api/useCanvasSources';
import { ColumnSelect } from './shared/ColumnSelect';
import { FormActions } from './shared/FormActions';
import type { OperationFormProps, JoinDataConfig, DbtModelResponse } from '@/types/transform';

const JoinTypes = [
  { id: 'left', label: 'Left Join' },
  { id: 'inner', label: 'Inner Join' },
  { id: 'full outer', label: 'Full Outer Join' },
];

interface FormValues {
  join_type: string;
  table1_key: string;
  table2_id: string;
  table2_key: string;
}

/**
 * Form for joining two tables based on matching columns.
 * Handles multi-input operation with dummy node management.
 */
export function JoinOpForm({
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
  const [table2Columns, setTable2Columns] = useState<string[]>([]);
  const [selectedTable2, setSelectedTable2] = useState<DbtModelResponse | null>(null);

  const { sourcesModels } = useCanvasSources();
  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      join_type: '',
      table1_key: '',
      table2_id: '',
      table2_key: '',
    },
  });

  const watchedTable2Id = watch('table2_id');

  // Fetch source columns from node (Table 1)
  useEffect(() => {
    if (node?.data?.output_columns) {
      setSrcColumns(node.data.output_columns.sort((a: string, b: string) => a.localeCompare(b)));
    }
  }, [node]);

  // Load existing config in edit mode
  useEffect(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config) {
      const config = node.data.operation_config.config as unknown as JoinDataConfig;
      if (config) {
        reset({
          join_type: config.join_type || '',
          table1_key: config.join_on?.key1 || '',
          table2_key: config.join_on?.key2 || '',
        });

        // Load table 2 info from other_inputs
        if (config.other_inputs && config.other_inputs.length > 0) {
          const secondaryInput = config.other_inputs[0];
          const model = sourcesModels.find((m) => m.name === secondaryInput.input?.input_name);
          if (model) {
            setSelectedTable2(model);
            setValue('table2_id', model.uuid);
            setTable2Columns(secondaryInput.source_columns || model.output_cols || []);
          }
        }

        // Load source columns
        if (config.source_columns) {
          setSrcColumns(config.source_columns.sort((a, b) => a.localeCompare(b)));
        }
      }
    }
  }, [isEditMode, isViewMode, node, reset, setValue, sourcesModels]);

  // Handle table 2 selection
  const handleTable2Select = (modelUuid: string) => {
    const model = sourcesModels.find((m) => m.uuid === modelUuid);
    if (!model) return;

    setSelectedTable2(model);
    setValue('table2_id', modelUuid);
    setValue('table2_key', ''); // Reset key when table changes
    setTable2Columns(model.output_cols || []);
  };

  // Build table options for searchable combobox
  const tableItems: ComboboxItem[] = sourcesModels
    .filter((m) => m.uuid !== node?.data?.dbtmodel?.uuid) // Exclude current table
    .map((model) => ({
      value: model.uuid,
      label: model.display_name || `${model.schema}.${model.name}`,
    }));

  const onSubmit = async (data: FormValues) => {
    if (!node?.id) {
      toastError.api('No node selected');
      return;
    }

    if (!data.join_type) {
      toastError.api('Join type is required');
      return;
    }

    if (!data.table1_key) {
      toastError.api('Table 1 key is required');
      return;
    }

    if (!data.table2_id || !selectedTable2) {
      toastError.api('Table 2 is required');
      return;
    }

    if (!data.table2_key) {
      toastError.api('Table 2 key is required');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        op_type: operation.slug,
        config: {
          join_type: data.join_type,
          join_on: {
            key1: data.table1_key,
            key2: data.table2_key,
            compare_with: '=',
          },
        },
        source_columns: srcColumns,
        other_inputs: [
          {
            input_model_uuid: selectedTable2.uuid,
            columns: table2Columns,
            seq: 1,
          },
        ],
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

      toastSuccess.generic('Join operation saved successfully');
      continueOperationChain(createdNodeUuid);
    } catch (error) {
      console.error('Failed to save join operation:', error);
      toastError.save(error, 'operation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
      {/* Join Type */}
      <div className="space-y-2">
        <Label>Join Type *</Label>
        <Controller
          control={control}
          name="join_type"
          rules={{ required: 'Join type is required' }}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange} disabled={isViewMode}>
              <SelectTrigger data-testid="join-type-select">
                <SelectValue placeholder="Select join type" />
              </SelectTrigger>
              <SelectContent>
                {JoinTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.join_type && <p className="text-sm text-destructive">{errors.join_type.message}</p>}
      </div>

      {/* Table 1 */}
      <div className="space-y-4 p-4 border rounded-md bg-muted/30">
        <h3 className="font-medium">Table 1</h3>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Table</Label>
          <div className="p-2 bg-background border rounded text-sm">
            {node?.data?.dbtmodel
              ? `${node.data.dbtmodel.schema}.${node.data.dbtmodel.name}`
              : node?.data?.name || 'Current Node'}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Key *</Label>
          <ColumnSelect
            value={watch('table1_key')}
            onChange={(value) => setValue('table1_key', value)}
            columns={srcColumns}
            placeholder="Select key column"
            disabled={isViewMode}
            testId="join-table1-key"
          />
        </div>
      </div>

      {/* Table 2 */}
      <div className="space-y-4 p-4 border rounded-md bg-muted/30">
        <h3 className="font-medium">Table 2</h3>
        <div className="space-y-2">
          <Label>Table *</Label>
          <Controller
            control={control}
            name="table2_id"
            rules={{ required: 'Table 2 is required' }}
            render={({ field }) => (
              <Combobox
                mode="single"
                items={tableItems}
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  handleTable2Select(value);
                }}
                placeholder="Select table to join"
                searchPlaceholder="Search tables..."
                emptyMessage="No matching tables."
                noItemsMessage="No tables available."
                disabled={isViewMode}
                id="join-table2-select"
                compact
              />
            )}
          />
          {errors.table2_id && (
            <p className="text-sm text-destructive">{errors.table2_id.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Key *</Label>
          <ColumnSelect
            value={watch('table2_key')}
            onChange={(value) => setValue('table2_key', value)}
            columns={table2Columns}
            placeholder="Select key column"
            disabled={isViewMode || !watchedTable2Id}
            testId="join-table2-key"
          />
        </div>
      </div>

      {/* Info */}
      <p className="text-xs text-muted-foreground">
        Join combines rows from Table 1 and Table 2 where the key columns match.
      </p>

      {/* Actions */}
      <FormActions
        isViewMode={isViewMode}
        isSubmitting={isCreating || isEditing}
        onCancel={clearAndClosePanel}
      />
    </form>
  );
}
