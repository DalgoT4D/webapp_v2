// components/transform/canvas/forms/FlattenJsonOpForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { apiGet } from '@/lib/api';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { ColumnSelect } from './shared/ColumnSelect';
import { FormActions } from './shared/FormActions';
import type {
  OperationFormProps,
  FlattenJsonDataConfig,
  DbtModelResponse,
  ModelSrcOtherInputPayload,
} from '@/types/transform';

interface FormValues {
  json_column: string;
}

/**
 * Form for flattening a JSON column into separate columns.
 * Auto-detects JSON structure and displays available paths.
 */
export function FlattenJsonOpForm({
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
  const [jsonColumns, setJsonColumns] = useState<string[]>([]);
  const [inputModels, setInputModels] = useState<DbtModelResponse[]>([]);
  const [isFetchingJson, setIsFetchingJson] = useState(false);
  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

  const {
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      json_column: '',
    },
  });

  const selectedJsonColumn = watch('json_column');

  // Determine schema and table name for JSON spec fetch
  const getSchemaAndTable = () => {
    if (isEditMode && inputModels.length > 0) {
      return {
        schema: inputModels[0].schema,
        table: inputModels[0].name,
      };
    }
    if (node?.data?.dbtmodel) {
      return {
        schema: node.data.dbtmodel.schema,
        table: node.data.dbtmodel.name,
      };
    }
    return { schema: null, table: null };
  };

  // Fetch JSON column spec
  const fetchJsonColumns = async (selectedColumn: string) => {
    const { schema, table } = getSchemaAndTable();
    if (!schema || !table || !selectedColumn) {
      setJsonColumns([]);
      return;
    }

    setIsFetchingJson(true);
    try {
      const data = (await apiGet(
        `/api/warehouse/dbt_project/json_columnspec/?source_schema=${schema}&input_name=${table}&json_column=${selectedColumn}`
      )) as string[];
      setJsonColumns(data || []);
    } catch (error) {
      console.error('Failed to fetch JSON column spec:', error);
      setJsonColumns([]);
    } finally {
      setIsFetchingJson(false);
    }
  };

  // Fetch source columns from node
  useEffect(() => {
    const fetchSourceColumns = async () => {
      if (!node) return;

      // For source/model nodes, try to get columns from dbtmodel
      if (['model', 'source'].includes(node.type || '') && node.data?.dbtmodel) {
        try {
          const data = (await apiGet(
            `/api/warehouse/table_columns/${node.data.dbtmodel.schema}/${node.data.dbtmodel.name}`
          )) as { name: string }[];
          const colNames = data
            .map((col: { name: string }) => col.name)
            .sort((a: string, b: string) => a.localeCompare(b));
          setSrcColumns(colNames);
        } catch (error) {
          console.error('Failed to fetch table columns:', error);
          if (node.data?.output_columns) {
            setSrcColumns(
              node.data.output_columns.sort((a: string, b: string) => a.localeCompare(b))
            );
          }
        }
      } else if (node.data?.output_columns) {
        // For operation nodes, use output_columns
        setSrcColumns(node.data.output_columns.sort((a: string, b: string) => a.localeCompare(b)));
      }
    };

    if (!isEditMode && !isViewMode) {
      fetchSourceColumns();
    }
  }, [node, isEditMode, isViewMode]);

  // Load existing config in edit mode
  useEffect(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config) {
      const config = node.data.operation_config.config as unknown as FlattenJsonDataConfig;
      if (config) {
        setSrcColumns(config.source_columns || []);
        setJsonColumns(config.json_columns_to_copy || []);
        reset({ json_column: config.json_column || '' });
      }

      // Store input models for schema lookup
      if (node.data?.input_nodes) {
        const models = node.data.input_nodes
          .map((n: { dbtmodel?: DbtModelResponse }) => n.dbtmodel)
          .filter((m): m is DbtModelResponse => m !== undefined);
        setInputModels(models);
      }
    }
  }, [isEditMode, isViewMode, node, reset]);

  // Handle JSON column selection
  const handleJsonColumnChange = (value: string) => {
    setValue('json_column', value);
    if (value) {
      fetchJsonColumns(value);
    } else {
      setJsonColumns([]);
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!node?.id) {
      toastError.api('No node selected');
      return;
    }

    if (!data.json_column) {
      toastError.api('JSON column is required');
      return;
    }

    if (jsonColumns.length === 0) {
      toastError.api('No JSON columns found to flatten');
      return;
    }

    setLoading(true);

    try {
      const { schema } = getSchemaAndTable();

      const payload = {
        op_type: operation.slug,
        config: {
          json_column: data.json_column,
          source_schema: schema,
          json_columns_to_copy: jsonColumns,
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

      toastSuccess.generic('Flatten JSON operation saved successfully');
      continueOperationChain(createdNodeUuid);
    } catch (error) {
      console.error('Failed to save flatten JSON operation:', error);
      toastError.save(error, 'operation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      {/* JSON Column Select */}
      <div className="border rounded-md">
        <div className="bg-muted px-4 py-3 rounded-t-md">
          <Label className="text-xs font-medium text-muted-foreground uppercase">
            Select JSON Column
          </Label>
        </div>
        <div className="p-4">
          <ColumnSelect
            value={selectedJsonColumn}
            onChange={handleJsonColumnChange}
            columns={srcColumns}
            placeholder="Select column containing JSON"
            disabled={isViewMode}
            testId="flatten-json-column"
          />
        </div>
      </div>

      {/* JSON Columns Display */}
      <div className="border rounded-md">
        <div className="bg-muted px-4 py-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase">
            JSON Columns
          </Label>
        </div>

        {isFetchingJson ? (
          <div className="flex items-center justify-center gap-2 p-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Fetching JSON structure...</span>
          </div>
        ) : jsonColumns.length > 0 ? (
          <div className="max-h-60 overflow-y-auto divide-y">
            {jsonColumns.map((column, index) => (
              <div key={index} className="px-4 py-2 text-sm font-mono">
                {column}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-3">
            <span className="text-sm text-muted-foreground">
              {selectedJsonColumn
                ? 'No JSON columns found'
                : 'Select a JSON column to see available paths'}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <p className="text-xs text-muted-foreground">
        The JSON column will be flattened into separate columns based on its structure.
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
