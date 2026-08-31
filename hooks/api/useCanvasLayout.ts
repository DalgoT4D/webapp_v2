'use client';

import { useCallback, useRef, useState } from 'react';
import { useSWRConfig } from 'swr';
import { apiPut } from '@/lib/api';
import { CANVAS_GRAPH_KEY } from './useCanvasGraph';
import type {
  CanvasLayoutUpdateResponse,
  CanvasNodePositionUpdate,
  DbtProjectGraphResponse,
} from '@/types/transform';

const LAYOUT_ENDPOINT = '/api/transform/v2/dbt_project/graph/layout/';

interface Deferred {
  resolve: (positions: CanvasNodePositionUpdate[]) => void;
  reject: (error: unknown) => void;
}

interface PendingUpdate {
  update: CanvasNodePositionUpdate;
  waiters: Set<Deferred>;
}

interface UseCanvasLayoutReturn {
  savePositions: (updates: CanvasNodePositionUpdate[]) => Promise<CanvasNodePositionUpdate[]>;
  retryFailed: () => Promise<CanvasNodePositionUpdate[]>;
  isSaving: boolean;
  error: Error | null;
}

export function useCanvasLayout(): UseCanvasLayoutReturn {
  const { mutate } = useSWRConfig();
  const pendingRef = useRef<Map<string, PendingUpdate>>(new Map());
  const inFlightRef = useRef(false);
  const failedByUuidRef = useRef<Map<string, CanvasNodePositionUpdate>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateGraphCache = useCallback(
    async (saved: CanvasNodePositionUpdate[]) => {
      const savedByUuid = new Map(saved.map((item) => [item.uuid, item.position]));
      await mutate(
        CANVAS_GRAPH_KEY,
        (current: DbtProjectGraphResponse | undefined) => {
          if (!current) return current;
          return {
            ...current,
            nodes: current.nodes.map((node) => {
              const position = savedByUuid.get(node.uuid);
              return position ? { ...node, position } : node;
            }),
          };
        },
        { revalidate: false }
      );
    },
    [mutate]
  );

  const flushPending = useCallback(async () => {
    if (inFlightRef.current || pendingRef.current.size === 0) return;

    const batch = Array.from(pendingRef.current.values());
    pendingRef.current.clear();
    const updates = batch.map((entry) => entry.update);
    const waiters = new Set(batch.flatMap((entry) => Array.from(entry.waiters)));

    inFlightRef.current = true;
    setIsSaving(true);
    setError(null);

    try {
      const response = (await apiPut(LAYOUT_ENDPOINT, {
        nodes: updates,
      })) as CanvasLayoutUpdateResponse;
      await updateGraphCache(response.nodes);
      response.nodes.forEach((saved) => failedByUuidRef.current.delete(saved.uuid));
      setError(
        failedByUuidRef.current.size > 0
          ? new Error('Some canvas layout changes could not be saved')
          : null
      );
      waiters.forEach((waiter) => waiter.resolve(response.nodes));
    } catch (caught) {
      const saveError =
        caught instanceof Error ? caught : new Error('Canvas layout could not be saved');
      updates.forEach((update) => failedByUuidRef.current.set(update.uuid, update));
      setError(saveError);
      waiters.forEach((waiter) => waiter.reject(saveError));
    } finally {
      inFlightRef.current = false;
      if (pendingRef.current.size > 0) {
        void flushPending();
      } else {
        setIsSaving(false);
      }
    }
  }, [updateGraphCache]);

  const savePositions = useCallback(
    (updates: CanvasNodePositionUpdate[]): Promise<CanvasNodePositionUpdate[]> => {
      if (updates.length === 0) return Promise.resolve([]);

      setError(null);
      const promise = new Promise<CanvasNodePositionUpdate[]>((resolve, reject) => {
        const deferred = { resolve, reject };
        updates.forEach((update) => {
          const pending = pendingRef.current.get(update.uuid);
          if (pending) {
            pending.update = update;
            pending.waiters.add(deferred);
          } else {
            pendingRef.current.set(update.uuid, {
              update,
              waiters: new Set([deferred]),
            });
          }
        });
      });

      void flushPending();
      return promise;
    },
    [flushPending]
  );

  const retryFailed = useCallback(() => {
    const failed = Array.from(failedByUuidRef.current.values());
    if (failed.length === 0) return Promise.resolve([]);
    return savePositions(failed);
  }, [savePositions]);

  return { savePositions, retryFailed, isSaving, error };
}
