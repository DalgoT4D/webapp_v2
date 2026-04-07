// Hook that handles interactions between the project tree sidebar and the canvas:
// finding nodes, focusing/selecting them, adding/removing sources.

import { useCallback } from 'react';
import useSWR from 'swr';
import { useCanvasSources } from '@/hooks/api/useCanvasSources';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { useTransformStore } from '@/stores/transformStore';
import { CANVAS_GRAPH_KEY } from '@/hooks/api/useCanvasGraph';
import {
  type DbtProjectGraphResponse,
  type CanvasNodeDataResponse,
  type SelectedNodeData,
} from '@/types/transform';
import { toastSuccess, toastError } from '@/lib/toast';
import { CanvasActionEnum } from '@/constants/transform';

interface UseSourceTreeActionsParams {
  isPreview: boolean;
}

export function useSourceTreeActions({ isPreview }: UseSourceTreeActionsParams) {
  const { sourcesModels, isLoading: isLoadingSources } = useCanvasSources();
  const { addNodeToCanvas } = useCanvasOperations();
  const { setSelectedLowerTab, setTempLockCanvas } = useTransformStore();

  // Read cached graph data
  const { data: graphData } = useSWR<DbtProjectGraphResponse>(isPreview ? null : CANVAS_GRAPH_KEY);

  // Find the canvas node for a given source model (by dbtmodel UUID match)
  const findCanvasNode = useCallback(
    (schema: string, table: string) => {
      const model = sourcesModels.find((m) => m.schema === schema && m.name === table);
      if (!model) return null;

      const canvasNode = graphData?.nodes?.find((n) => n.dbtmodel?.uuid === model.uuid);
      return canvasNode ?? null;
    },
    [sourcesModels, graphData?.nodes]
  );

  // Focus canvas viewport on a node AND select it so the operation panel targets it
  const focusAndSelectCanvasNode = useCallback(
    (canvasNodeUuid: string, nodeType: string, nodeData: CanvasNodeDataResponse) => {
      const store = useTransformStore.getState();
      store.setSelectedNode({
        id: canvasNodeUuid,
        type: nodeType,
        data: { ...nodeData, isDummy: false },
      } as SelectedNodeData);
      store.dispatchCanvasAction({
        type: CanvasActionEnum.FOCUS_NODE,
        data: { nodeId: canvasNodeUuid },
      });
    },
    []
  );

  // Handle table select from project tree (for preview + focus)
  const handleTableSelect = useCallback(
    (schema: string, table: string) => {
      useTransformStore.getState().setPreviewAction({
        type: 'preview',
        data: { schema, table },
      });
      setSelectedLowerTab('preview');

      // If the table is on the canvas, focus on it and select it
      const canvasNode = findCanvasNode(schema, table);
      if (canvasNode) {
        focusAndSelectCanvasNode(canvasNode.uuid, canvasNode.node_type, canvasNode);
      }
    },
    [setSelectedLowerTab, findCanvasNode, focusAndSelectCanvasNode]
  );

  // Handle delete from canvas (via project tree)
  const handleDeleteFromCanvas = useCallback((nodeId: string) => {
    useTransformStore.getState().dispatchCanvasAction({
      type: CanvasActionEnum.DELETE_SOURCE_TREE_NODE,
      data: { nodeId },
    });
  }, []);

  // Handle add to canvas — if already on canvas, just focus on it
  const handleAddToCanvas = useCallback(
    async (schema: string, table: string) => {
      const model = sourcesModels.find((m) => m.schema === schema && m.name === table);

      if (!model) {
        toastError.api(`Could not find ${schema}.${table}`);
        return;
      }

      // If already on the canvas, focus and select it instead of re-adding
      const existingNode = findCanvasNode(schema, table);
      if (existingNode) {
        focusAndSelectCanvasNode(existingNode.uuid, existingNode.node_type, existingNode);
        return;
      }

      setTempLockCanvas(true);
      try {
        // addNodeToCanvas already calls refreshGraph() internally
        const newNode = await addNodeToCanvas(model.uuid);
        toastSuccess.generic(`Added ${table} to canvas`);

        // Focus and select the newly added node
        focusAndSelectCanvasNode(newNode.uuid, newNode.node_type, newNode);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : `Failed to add ${table} to canvas`;
        toastError.api(message);
      } finally {
        setTempLockCanvas(false);
      }
    },
    [sourcesModels, addNodeToCanvas, setTempLockCanvas, findCanvasNode, focusAndSelectCanvasNode]
  );

  return {
    sourcesModels,
    isLoadingSources,
    graphData,
    handleTableSelect,
    handleDeleteFromCanvas,
    handleAddToCanvas,
  };
}
