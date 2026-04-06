// Shared hook for operation form logic
// Extracts common mode detection, source columns initialization,
// and submit logic used by all operation forms (except Join/Union).
'use client';

import { useState, useCallback } from 'react';
import { toastSuccess, toastError } from '@/lib/toast';
import { useCanvasOperations } from '@/hooks/api/useCanvasOperations';
import { OperationFormAction } from '@/constants/transform';
import type {
  OperationFormProps,
  EditOperationNodePayload,
  ModelSrcOtherInputPayload,
} from '@/types/transform';

export interface OperationPayload {
  op_type: string;
  config: Record<string, unknown>;
  source_columns: string[];
  other_inputs?: ModelSrcOtherInputPayload[];
}

interface UseOperationFormOptions {
  node: OperationFormProps['node'];
  action: OperationFormProps['action'];
  operation: OperationFormProps['operation'];
  continueOperationChain: OperationFormProps['continueOperationChain'];
  setLoading: OperationFormProps['setLoading'];
  sortColumns?: boolean;
}

interface UseOperationFormReturn {
  isViewMode: boolean;
  isEditMode: boolean;
  srcColumns: string[];
  isSubmitting: boolean;
  submitOperation: (payload: OperationPayload, successMessage: string) => Promise<void>;
}

export function useOperationForm({
  node,
  action,
  operation,
  continueOperationChain,
  setLoading,
  sortColumns = false,
}: UseOperationFormOptions): UseOperationFormReturn {
  const isViewMode = action === OperationFormAction.VIEW;
  const isEditMode = action === OperationFormAction.EDIT;

  const [srcColumns] = useState<string[]>(() => {
    if ((isEditMode || isViewMode) && node?.data?.operation_config?.config) {
      const config = node.data.operation_config.config;
      const configCols = config?.source_columns;
      if (Array.isArray(configCols)) {
        return sortColumns
          ? [...configCols].sort((a: string, b: string) => a.localeCompare(b))
          : configCols;
      }
    }
    const outputCols = node?.data?.output_columns || [];
    return sortColumns
      ? [...outputCols].sort((a: string, b: string) => a.localeCompare(b))
      : outputCols;
  });

  const { createOperation, editOperation, isCreating, isEditing } = useCanvasOperations();

  const submitOperation = useCallback(
    async (payload: OperationPayload, successMessage: string) => {
      if (!node?.id) {
        toastError.api('No node selected');
        return;
      }

      const fullPayload: EditOperationNodePayload = {
        ...payload,
        other_inputs: payload.other_inputs ?? [],
      };

      setLoading(true);
      try {
        const finalAction = node.data?.isDummy ? OperationFormAction.CREATE : action;
        let createdNodeUuid: string | undefined;

        if (finalAction === OperationFormAction.EDIT) {
          await editOperation(node.id, fullPayload);
        } else {
          const response = await createOperation(node.id, {
            ...fullPayload,
            input_node_uuid: node.id,
          });
          createdNodeUuid = response?.uuid;
        }

        toastSuccess.generic(successMessage);
        continueOperationChain(createdNodeUuid);
      } catch (error) {
        console.error(`Failed to save ${operation.slug} operation:`, error);
        toastError.save(error, 'operation');
      } finally {
        setLoading(false);
      }
    },
    [
      node,
      action,
      operation.slug,
      continueOperationChain,
      setLoading,
      createOperation,
      editOperation,
    ]
  );

  return {
    isViewMode,
    isEditMode,
    srcColumns,
    isSubmitting: isCreating || isEditing,
    submitOperation,
  };
}
