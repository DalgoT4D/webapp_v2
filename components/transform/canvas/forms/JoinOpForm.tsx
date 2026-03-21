// components/transform/canvas/forms/JoinOpForm.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useReactFlow } from 'reactflow';
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
import { apiGet } from '@/lib/api';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { useCanvasSources } from '@/hooks/api/useCanvasSources';
import { generateDummySrcModelNode } from '../utils/dummynodes';
import { ColumnSelect } from './shared/ColumnSelect';
import { FormActions } from './shared/FormActions';
import type { OperationFormProps, JoinDataConfig, CanvasNodeDataResponse } from '@/types/transform';

const JoinTypes = [
  { id: 'left', label: 'Left Join' },
  { id: 'right', label: 'Right Join' },
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

  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const [table2Columns, setTable2Columns] = useState<string[]>([]);
  const [selectedTable2, setSelectedTable2] = useState<{ uuid: string } | null>(null);

  const { addNodes, addEdges, deleteElements, getNodes } = useReactFlow();
  const dummyNodeIdsRef = useRef<string[]>([]);

  const { sourcesModels } = useCanvasSources();
  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

  // Cleanup dummy nodes on unmount
  useEffect(() => {
    return () => {
      if (dummyNodeIdsRef.current.length > 0) {
        deleteElements({
          nodes: dummyNodeIdsRef.current.map((id) => ({ id })),
          edges: [],
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Fetch node detail from API and pre-fill form (v1 pattern)
  const fetchAndSetConfigForEdit = useCallback(async () => {
    if (!stableNode?.id) return;
    try {
      setLoading(true);
      const nodeResponseData = (await apiGet(
        `/api/transform/v2/dbt_project/nodes/${stableNode.id}/`
      )) as CanvasNodeDataResponse;
      const { operation_config, input_nodes } = nodeResponseData;

      const { source_columns, join_on, join_type } =
        operation_config.config as unknown as JoinDataConfig;
      setSrcColumns(source_columns?.sort((a, b) => a.localeCompare(b)) || []);

      if (input_nodes) {
        let jointype: string = join_type;
        const lengthInputModels: number = input_nodes.length;

        // Right-join detection: v1 stores right join as left join with seq=0
        if (lengthInputModels === 1) {
          if (input_nodes[0].seq === 0 && jointype === 'left') {
            jointype = 'right';
          }
          setTable2Columns(input_nodes[0].dbtmodel?.output_cols || []);
        }

        // Pre-fill table2 model for submit
        const table2Node = input_nodes[lengthInputModels - 1];
        if (table2Node?.dbtmodel) {
          setSelectedTable2({ uuid: table2Node.dbtmodel.uuid });
          setTable2Columns(table2Node.dbtmodel.output_cols || []);
        }

        reset({
          join_type: jointype,
          table1_key: join_on?.key1 || '',
          table2_key: join_on?.key2 || '',
          table2_id: table2Node?.dbtmodel?.uuid || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch node config for edit:', error);
    } finally {
      setLoading(false);
    }
  }, [stableNode?.id, reset, setLoading]);

  // Fetch source columns from node (Table 1) — for create mode
  const fetchAndSetSourceColumns = useCallback(() => {
    if (stableNode?.data?.output_columns) {
      setSrcColumns(stableNode.data.output_columns.sort((a: string, b: string) => a.localeCompare(b)));
    }
  }, [stableNode]);

  // Load form data — matches v1 pattern
  useEffect(() => {
    if (stableNode?.data?.isDummy) return;

    if (isEditMode || isViewMode) {
      fetchAndSetConfigForEdit();
    } else {
      fetchAndSetSourceColumns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableNode]);

  // Handle table 2 selection — also add dummy node to canvas
  const handleTable2Select = useCallback(
    (modelUuid: string) => {
      const model = sourcesModels.find((m) => m.uuid === modelUuid);
      if (!model) return;

      // Clean up previous dummy
      if (dummyNodeIdsRef.current.length > 0) {
        deleteElements({
          nodes: dummyNodeIdsRef.current.map((id) => ({ id })),
          edges: [],
        });
        dummyNodeIdsRef.current = [];
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
          y: refPos.y + 200,
        },
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
      dummyNodeIdsRef.current.push(dummyNode.id);

      setSelectedTable2({ uuid: model.uuid });
      setValue('table2_id', modelUuid);
      setValue('table2_key', ''); // Reset key when table changes
      setTable2Columns(model.output_cols || []);
    },
    [sourcesModels, stableNode?.id, dummyNodeId, deleteElements, getNodes, addNodes, addEdges, setValue]
  );

  // Build table options for searchable combobox, grouped by schema
  const tableItems: ComboboxItem[] = sourcesModels
    .filter((m) => m.uuid !== stableNode?.data?.dbtmodel?.uuid) // Exclude current table
    .map((model) => ({
      value: model.uuid,
      label: model.display_name || `${model.schema}.${model.name}`,
      group: model.schema,
    }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));

  const onSubmit = async (data: FormValues) => {
    if (!stableNode?.id) {
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

    // Remove dummy source nodes before API call to prevent orphan edges
    if (dummyNodeIdsRef.current.length > 0) {
      deleteElements({
        nodes: dummyNodeIdsRef.current.map((id) => ({ id })),
        edges: [],
      });
      dummyNodeIdsRef.current = [];
    }

    try {
      // Right-join encoding: store as left join with seq=0 (v1 pattern)
      const payload = {
        op_type: operation.slug,
        config: {
          join_type: data.join_type === 'right' ? 'left' : data.join_type,
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
            seq: data.join_type === 'right' ? 0 : 2,
          },
        ],
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
            {stableNode?.data?.dbtmodel
              ? `${stableNode.data.dbtmodel.schema}.${stableNode.data.dbtmodel.name}`
              : stableNode?.data?.name || 'Current Node'}
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
