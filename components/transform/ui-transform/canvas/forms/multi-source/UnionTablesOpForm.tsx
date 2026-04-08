// components/transform/canvas/forms/UnionTablesOpForm.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { useReactFlow } from 'reactflow';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxItem } from '@/components/ui/combobox';
import { Plus, Trash2, Info } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { apiGet } from '@/lib/api';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { useCanvasSources } from '@/hooks/api/useCanvasSources';
import { generateDummySrcModelNode } from '../../utils/dummynodes';
import { FormActions } from '../shared/FormActions';
import { UNION_OP } from '@/constants/transform';
import { getTypedConfig } from '@/types/transform';
import type { OperationFormProps, CanvasNodeDataResponse } from '@/types/transform';

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
  dummyNodeId,
  action,
  setLoading,
}: OperationFormProps) {
  const isViewMode = action === 'view';
  const isEditMode = action === 'edit';

  // Capture node on mount so it's stable even if selectedNode changes in the store
  // (e.g. user clicks canvas pane which sets selectedNode to null)
  const stableNodeRef = useRef(node);
  if (!stableNodeRef.current && node) {
    stableNodeRef.current = node;
  }
  const stableNode = stableNodeRef.current;

  const [srcColumns, setSrcColumns] = useState<string[]>(() => {
    if (!isEditMode && !isViewMode && stableNode?.data?.output_columns) {
      return stableNode.data.output_columns;
    }
    return [];
  });

  const { addNodes, addEdges, deleteElements, getNodes } = useReactFlow();
  // Map index -> dummy node id for cleanup
  const dummyNodeMapRef = useRef<Map<number, string>>(new Map());

  const { sourcesModels } = useCanvasSources();
  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

  // Cleanup all dummy nodes on unmount (backup safety net)
  useEffect(() => {
    return () => {
      const ids = Array.from(dummyNodeMapRef.current.values());
      if (ids.length > 0) {
        deleteElements({
          nodes: ids.map((id) => ({ id })),
          edges: [],
        });
        dummyNodeMapRef.current.clear();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: (() => {
      if (!isEditMode && !isViewMode && stableNode) {
        const label = stableNode.data?.dbtmodel
          ? `${stableNode.data.dbtmodel.schema}.${stableNode.data.dbtmodel.name}`
          : stableNode.data?.name || '';
        const id = stableNode.data?.dbtmodel?.uuid || stableNode.id;
        return {
          tables: [
            { id, label },
            { id: '', label: '' },
          ],
        };
      }
      return {
        tables: [
          { id: '', label: '' },
          { id: '', label: '' },
        ],
      };
    })(),
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'tables',
  });

  // Fetch node detail from API and pre-fill form (v1 pattern)
  const fetchAndSetConfigForEdit = useCallback(async () => {
    if (!stableNode?.id) return;
    try {
      setLoading(true);
      const nodeResponseData = (await apiGet(
        `/api/transform/v2/dbt_project/nodes/${stableNode.id}/`
      )) as CanvasNodeDataResponse;
      const { operation_config, input_nodes } = nodeResponseData;

      const { source_columns } = getTypedConfig(UNION_OP, operation_config)!;
      setSrcColumns(source_columns);

      // Sort input_nodes by seq to ensure correct order
      const sortedInputNodes =
        input_nodes?.sort(
          (a: CanvasNodeDataResponse, b: CanvasNodeDataResponse) => (a.seq || 0) - (b.seq || 0)
        ) || [];

      // Build the tables array from input_nodes
      const tablesData = sortedInputNodes
        .filter((n: CanvasNodeDataResponse) => n.dbtmodel)
        .map((n: CanvasNodeDataResponse) => ({
          id: n.dbtmodel!.uuid,
          label: `${n.dbtmodel!.schema}.${n.dbtmodel!.name}`,
        }));

      if (tablesData.length > 0) {
        reset({ tables: tablesData });
      }
    } catch (error) {
      console.error('Failed to fetch node config for edit:', error);
    } finally {
      setLoading(false);
    }
  }, [stableNode?.id, reset, setLoading]);

  // Load form data — matches v1 pattern
  useEffect(() => {
    if (stableNode?.data?.isDummy) return;
    if (isEditMode || isViewMode) {
      fetchAndSetConfigForEdit();
    }
    // Create mode initialization is handled by useState/useForm defaults
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableNode]);

  // Handle table selection — also add dummy node to canvas
  const handleTableSelect = useCallback(
    (index: number, modelUuid: string) => {
      const model = sourcesModels.find((m) => m.uuid === modelUuid);
      if (!model) return;

      // Clean up previous dummy for this index
      const prevDummyId = dummyNodeMapRef.current.get(index);
      if (prevDummyId) {
        deleteElements({ nodes: [{ id: prevDummyId }], edges: [] });
        dummyNodeMapRef.current.delete(index);
      }

      // Position dummy source node relative to the dummy operation node,
      // falling back to stableNode.position (stored at click time, like v1's xPos/yPos)
      const nodes = getNodes();
      const opNode = dummyNodeId ? nodes.find((n) => n.id === dummyNodeId) : null;
      const refPos = opNode?.position || stableNode?.position || { x: 0, y: 0 };
      const dummyNode = generateDummySrcModelNode({
        schema: model.schema,
        name: model.display_name || model.name,
        type: model.type as 'source' | 'model',
        position: {
          x: refPos.x - 350,
          y: refPos.y + 200 * index,
        },
        outputColumns: model.output_cols || [],
      });

      // Edge goes from dummy source node → dummy operation node (matching v1)
      const dummyEdge = {
        id: `edge-dummy-${dummyNode.id}`,
        source: dummyNode.id,
        target: dummyNodeId || stableNode?.id || '',
        type: 'default',
        animated: true,
        style: { strokeDasharray: '5,5' },
      };

      addNodes([dummyNode]);
      addEdges([dummyEdge]);
      dummyNodeMapRef.current.set(index, dummyNode.id);

      // Update form value
      setValue(`tables.${index}`, {
        id: modelUuid,
        label: `${model.schema}.${model.name}`,
      });
    },
    [
      sourcesModels,
      stableNode?.id,
      dummyNodeId,
      deleteElements,
      getNodes,
      addNodes,
      addEdges,
      setValue,
    ]
  );

  // Handle remove table — also clean up its dummy node
  const handleRemoveTable = useCallback(
    (index: number) => {
      const dummyId = dummyNodeMapRef.current.get(index);
      if (dummyId) {
        deleteElements({ nodes: [{ id: dummyId }], edges: [] });
        dummyNodeMapRef.current.delete(index);
      }
      remove(index);
    },
    [deleteElements, remove]
  );

  // Build table items for searchable combobox, grouped by schema
  const tableItems: ComboboxItem[] = sourcesModels
    .filter((m) => m.uuid !== stableNode?.data?.dbtmodel?.uuid) // Exclude current table
    .map((model) => ({
      value: model.uuid,
      label: model.display_name || `${model.schema}.${model.name}`,
      group: model.schema,
    }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));

  // Clean up all dummy source nodes and their edges before save
  const cleanupDummySourceNodes = useCallback(() => {
    const ids = Array.from(dummyNodeMapRef.current.values());
    if (ids.length > 0) {
      deleteElements({
        nodes: ids.map((id) => ({ id })),
        edges: [],
      });
      dummyNodeMapRef.current.clear();
    }
  }, [deleteElements]);

  const onSubmit = async (data: FormValues) => {
    if (!stableNode?.id) {
      toastError.api('No node selected');
      return;
    }

    const validTables = data.tables.filter((t) => t.id);
    if (validTables.length < 2) {
      toastError.api('At least two tables are required for union');
      return;
    }

    setLoading(true);

    // Remove dummy source nodes before API call to prevent orphan edges
    cleanupDummySourceNodes();

    try {
      // Fetch columns for each table (excluding the first one which is the input node)
      const otherInputs = await Promise.all(
        validTables.slice(1).map(async (table, index) => {
          const model = sourcesModels.find((m) => m.uuid === table.id);
          let columns: string[] = model?.output_cols || [];

          // Try to fetch columns from warehouse if not available
          if (columns.length === 0 && model) {
            try {
              const colData = (await apiGet(
                `/api/warehouse/table_columns/${model.schema}/${model.name}`
              )) as { name: string }[];
              columns = colData.map((c: { name: string }) => c.name);
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

      const finalAction = stableNode.data?.isDummy ? 'create' : action;
      let createdNodeUuid: string | undefined;
      if (finalAction === 'edit') {
        await editOperation(stableNode.id, payload);
      } else {
        const response = await createOperation(stableNode.id, {
          ...payload,
          input_node_uuid: stableNode.id,
        });
        createdNodeUuid = response?.uuid;
      }

      toastSuccess.generic('Union operation saved successfully');
      continueOperationChain(createdNodeUuid);
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
                {index === 0 ? (
                  <Input
                    value={formField.value?.label || ''}
                    disabled
                    data-testid="union-table-0"
                  />
                ) : (
                  <Combobox
                    mode="single"
                    items={tableItems}
                    value={formField.value?.id || ''}
                    onValueChange={(value) => {
                      handleTableSelect(index, value);
                    }}
                    placeholder="Select table"
                    searchPlaceholder="Search tables..."
                    emptyMessage="No matching tables."
                    noItemsMessage="No tables available."
                    disabled={isViewMode}
                    id={`union-table-${index}`}
                    compact
                  />
                )}
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
              {index > 0 && fields.length > 2 && (
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
