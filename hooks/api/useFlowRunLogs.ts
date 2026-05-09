import { useState, useCallback } from 'react';
import { FLOW_RUN_LOGS_OFFSET_LIMIT } from '@/constants/pipeline';

interface UseFlowRunLogsOptions {
  fetcher: (offset: number) => Promise<string[]>;
  pageSize?: number;
}

interface UseFlowRunLogsResult {
  logs: string[];
  isLoading: boolean;
  hasMore: boolean;
  load: () => Promise<void>;
  fetchMore: () => Promise<void>;
  reset: () => void;
}

/**
 * Shared pagination state for flow-run logs.
 * Used by Pipeline overview and Orchestrate so both behave identically.
 */
export function useFlowRunLogs({
  fetcher,
  pageSize = FLOW_RUN_LOGS_OFFSET_LIMIT,
}: UseFlowRunLogsOptions): UseFlowRunLogsResult {
  const [logs, setLogs] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const reset = useCallback(() => {
    setLogs([]);
    setOffset(0);
    setHasMore(false);
    setIsLoading(false);
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetched = await fetcher(0);
      setLogs(fetched);
      setHasMore(fetched.length >= pageSize);
      setOffset(pageSize);
    } finally {
      setIsLoading(false);
    }
  }, [fetcher, pageSize]);

  const fetchMore = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const fetched = await fetcher(offset);
      setLogs((prev) => [...prev, ...fetched]);
      setHasMore(fetched.length >= pageSize);
      setOffset((prev) => prev + pageSize);
    } finally {
      setIsLoading(false);
    }
  }, [fetcher, isLoading, offset, pageSize]);

  return { logs, isLoading, hasMore, load, fetchMore, reset };
}
