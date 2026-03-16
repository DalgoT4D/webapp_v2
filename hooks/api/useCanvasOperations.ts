// hooks/api/useCanvasOperations.ts
'use client';

import { useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { apiPost, apiPut, apiDelete } from '@/lib/api';
import { CANVAS_GRAPH_KEY } from './useCanvasGraph';
import type {
  CanvasNodeDataResponse,
  CreateOperationNodePayload,
  EditOperationNodePayload,
  TerminateChainAndCreateModelPayload,
} from '@/types/transform';

interface UseCanvasOperationsReturn {
  /** Add source/model to canvas */
  addNodeToCanvas: (dbtmodelUuid: string) => Promise<CanvasNodeDataResponse>;

  /** Create operation node */
  createOperation: (
    inputNodeUuid: string,
    payload: CreateOperationNodePayload
  ) => Promise<CanvasNodeDataResponse>;

  /** Edit operation node */
  editOperation: (
    nodeUuid: string,
    payload: EditOperationNodePayload
  ) => Promise<CanvasNodeDataResponse>;

  /** Delete operation node */
  deleteOperationNode: (nodeUuid: string) => Promise<void>;

  /** Delete source/model node */
  deleteModelNode: (nodeUuid: string) => Promise<void>;

  /** Terminate chain and create model */
  terminateChain: (nodeUuid: string, payload: TerminateChainAndCreateModelPayload) => Promise<void>;

  /** Loading states */
  isCreating: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  isTerminating: boolean;
}

export function useCanvasOperations(): UseCanvasOperationsReturn {
  const { mutate } = useSWRConfig();
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);

  const refreshGraph = useCallback(async () => {
    await mutate(CANVAS_GRAPH_KEY);
  }, [mutate]);

  const addNodeToCanvas = useCallback(
    async (dbtmodelUuid: string): Promise<CanvasNodeDataResponse> => {
      setIsCreating(true);
      try {
        const response = await apiPost<CanvasNodeDataResponse>(
          `/api/transform/v2/dbt_project/models/${dbtmodelUuid}/nodes/`,
          {}
        );
        await refreshGraph();
        return response;
      } finally {
        setIsCreating(false);
      }
    },
    [refreshGraph]
  );

  const createOperation = useCallback(
    async (
      inputNodeUuid: string,
      payload: CreateOperationNodePayload
    ): Promise<CanvasNodeDataResponse> => {
      setIsCreating(true);
      try {
        // POST to operations/nodes/ with input_node_uuid in payload
        const response = await apiPost<CanvasNodeDataResponse>(
          `/api/transform/v2/dbt_project/operations/nodes/`,
          {
            ...payload,
            input_node_uuid: inputNodeUuid,
          }
        );
        await refreshGraph();
        return response;
      } finally {
        setIsCreating(false);
      }
    },
    [refreshGraph]
  );

  const editOperation = useCallback(
    async (
      nodeUuid: string,
      payload: EditOperationNodePayload
    ): Promise<CanvasNodeDataResponse> => {
      setIsEditing(true);
      try {
        // PUT to operations/nodes/{nodeUuid}/
        const response = await apiPut<CanvasNodeDataResponse>(
          `/api/transform/v2/dbt_project/operations/nodes/${nodeUuid}/`,
          payload
        );
        await refreshGraph();
        return response;
      } finally {
        setIsEditing(false);
      }
    },
    [refreshGraph]
  );

  const deleteOperationNode = useCallback(
    async (nodeUuid: string): Promise<void> => {
      setIsDeleting(true);
      try {
        await apiDelete(`/api/transform/v2/dbt_project/nodes/${nodeUuid}/`);
        await refreshGraph();
      } finally {
        setIsDeleting(false);
      }
    },
    [refreshGraph]
  );

  const deleteModelNode = useCallback(
    async (nodeUuid: string): Promise<void> => {
      setIsDeleting(true);
      try {
        await apiDelete(`/api/transform/v2/dbt_project/model/${nodeUuid}/`);
        await refreshGraph();
      } finally {
        setIsDeleting(false);
      }
    },
    [refreshGraph]
  );

  const terminateChain = useCallback(
    async (nodeUuid: string, payload: TerminateChainAndCreateModelPayload): Promise<void> => {
      setIsTerminating(true);
      try {
        await apiPost(
          `/api/transform/v2/dbt_project/operations/nodes/${nodeUuid}/terminate/`,
          payload
        );
        await refreshGraph();
      } finally {
        setIsTerminating(false);
      }
    },
    [refreshGraph]
  );

  return {
    addNodeToCanvas,
    createOperation,
    editOperation,
    deleteOperationNode,
    deleteModelNode,
    terminateChain,
    isCreating,
    isEditing,
    isDeleting,
    isTerminating,
  };
}
