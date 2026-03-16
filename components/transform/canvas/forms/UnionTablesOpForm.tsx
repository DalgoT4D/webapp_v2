// components/transform/canvas/forms/UnionTablesOpForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Plus, Trash2, Info } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { apiGet } from '@/lib/api';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { useCanvasSources } from '@/hooks/api/useCanvasSources';
import { FormActions } from './shared/FormActions';
import type { OperationFormProps, UnionDataConfig, DbtModelResponse } from '@/types/transform';

interface TableItem {
  id: string;
  label: string;
}

interface FormValues {
  tables: TableItem[];
}

/**
 * Form for unioning (combining rows from) multiple tables.
 * Supports adding multiple tables with dummy node management.
 */
export function UnionTablesOpForm({
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

  const { sourcesModels } = useCanvasSources();
  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      tables: [
        { id: '', label: '' }, // Table 1 (current node - readonly)
        { id: '', label: '' }, // Table 2 (user selects)
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'tables',
  });

  // Fetch source columns from node (Table 1)
  useEffect(() => {
    if (node?.data?.output_columns) {
      setSrcColumns(node.data.output_columns);
    }

    // Set Table 1 to current node
    if (node?.data?.dbtmodel) {
      setValue('tables.0', {
        id: node.data.dbtmodel.uuid || node.id,
        label: `${node.data.dbtmodel.schema}.${node.data.dbtmodel.name}`,
      });
    } else if (node?.data?.name) {
      setValue('tables.0', {
        id: node.id,
        label: node.data.name,
      });
    }
  }, [node, setValue]);

  // Load existing config in edit mode
  useEffect(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config) {
      const config = node.data.operation_config.config as UnionDataConfig;
      if (config?.source_columns) {
        setSrcColumns(config.source_columns);
      }

      // Load tables from input_nodes
      if (node.data?.input_nodes) {
        const sortedInputNodes = [...(node.data.input_nodes || [])].sort(
          (a: { seq?: number }, b: { seq?: number }) => (a.seq || 0) - (b.seq || 0)
        );

        const tablesData = sortedInputNodes
          .filter((n: { dbtmodel?: DbtModelResponse }) => n.dbtmodel)
          .map((n: { dbtmodel: DbtModelResponse }) => ({
            id: n.dbtmodel.uuid,
            label: `${n.dbtmodel.schema}.${n.dbtmodel.name}`,
          }));

        if (tablesData.length > 0) {
          reset({ tables: tablesData });
        }
      }
    }
  }, [isEditMode, isViewMode, node, reset]);

  // Handle table selection
  const handleTableSelect = (index: number, modelUuid: string) => {
    const model = sourcesModels.find((m) => m.uuid === modelUuid);
    if (!model) return;

    // Update form value
    setValue(`tables.${index}`, {
      id: modelUuid,
      label: `${model.schema}.${model.name}`,
    });
  };

  // Handle remove table
  const handleRemoveTable = (index: number) => {
    remove(index);
  };

  // Build table options grouped by schema
  const tableOptions = sourcesModels
    .filter((m) => m.uuid !== node?.data?.dbtmodel?.uuid) // Exclude current table
    .reduce(
      (acc, model) => {
        const schema = model.schema || 'Other';
        if (!acc[schema]) acc[schema] = [];
        acc[schema].push({
          id: model.uuid,
          label: model.display_name || model.name,
          schema,
        });
        return acc;
      },
      {} as Record<string, { id: string; label: string; schema: string }[]>
    );

  const onSubmit = async (data: FormValues) => {
    if (!node?.id) {
      toastError.api('No node selected');
      return;
    }

    const validTables = data.tables.filter((t) => t.id);
    if (validTables.length < 2) {
      toastError.api('At least two tables are required for union');
      return;
    }

    setLoading(true);

    try {
      // Fetch columns for each table (excluding the first one which is the input node)
      const otherInputs = await Promise.all(
        validTables.slice(1).map(async (table, index) => {
          const model = sourcesModels.find((m) => m.uuid === table.id);
          let columns: string[] = model?.output_cols || [];

          // Try to fetch columns from warehouse if not available
          if (columns.length === 0 && model) {
            try {
              const data = await apiGet<{ name: string }[]>(
                `/api/warehouse/table_columns/${model.schema}/${model.name}`
              );
              columns = data.map((c) => c.name);
            } catch (error) {
              console.error('Failed to fetch columns for table:', model.name);
            }
          }

          return {
            input_model_uuid: table.id,
            columns,
            seq: index + 2, // Starts from 2 since first table is seq 1
          };
        })
      );

      const payload = {
        op_type: operation.slug,
        config: {},
        source_columns: srcColumns,
        other_inputs: otherInputs,
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

      toastSuccess.generic('Union operation saved successfully');
      continueOperationChain();
    } catch (error) {
      console.error('Failed to save union operation:', error);
      toastError.save(error, 'operation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      {/* Tables */}
      {fields.map((field, index) => (
        <div key={field.id} className="space-y-2">
          <Label>Select table no {index + 1} *</Label>
          <Controller
            control={control}
            name={`tables.${index}`}
            rules={{
              validate: (value) => (value && value.id !== '') || `Table ${index + 1} is required`,
            }}
            render={({ field: formField, fieldState }) => (
              <div className="space-y-2">
                <Select
                  value={formField.value?.id || ''}
                  onValueChange={(value) => {
                    handleTableSelect(index, value);
                  }}
                  disabled={index === 0 || isViewMode} // First table is current node
                >
                  <SelectTrigger data-testid={`union-table-${index}`}>
                    <SelectValue placeholder="Select table">
                      {formField.value?.label || 'Select table'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(tableOptions).map(([schema, options]) => (
                      <SelectGroup key={schema}>
                        <SelectLabel>{schema}</SelectLabel>
                        {options.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.error && (
                  <p className="text-sm text-destructive">{fieldState.error.message}</p>
                )}
              </div>
            )}
          />

          {/* Add/Remove Buttons */}
          {!isViewMode && (
            <div className="flex gap-2">
              {index === fields.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ id: '', label: '' })}
                  data-testid="union-add-table"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Table
                </Button>
              )}
              {index > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveTable(index)}
                  data-testid={`union-remove-table-${index}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Info Box */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-md text-sm text-blue-700">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Columns not belonging to all tables will yield NULL values in the union result.</span>
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
