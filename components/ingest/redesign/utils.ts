import { SyncStatus } from '@/constants/connections';
import { LockStatus } from '@/constants/pipeline';
import type { Connection } from '@/types/connections';
import type { Source } from '@/types/source';

export interface SourceGroupData {
  source: Source;
  connections: Connection[];
}

/**
 * Group connections under their source. Every source is included, even those
 * with zero connections (they render as a plain "add a connection" row).
 */
export function groupConnectionsBySource(
  sources: Source[],
  connections: Connection[]
): SourceGroupData[] {
  return sources.map((source) => ({
    source,
    connections: connections.filter((c) => c.source?.sourceId === source.sourceId),
  }));
}

/**
 * Derive a single status key for a connection. Mirrors the lock-then-lastRun
 * logic in sync-status-cell.tsx (reproduced here so the classic component stays
 * untouched). Returns null when the connection has never run.
 */
export function deriveConnectionStatus(conn: Connection): SyncStatus | null {
  const lockStatus = conn.lock?.status;
  if (lockStatus === LockStatus.RUNNING) return SyncStatus.RUNNING;
  if (lockStatus === LockStatus.CANCELLED) return SyncStatus.CANCELLED;
  if (lockStatus === LockStatus.LOCKED || lockStatus === LockStatus.COMPLETE) {
    return SyncStatus.LOCKED;
  }
  if (lockStatus === LockStatus.QUEUED) return SyncStatus.QUEUED;
  if (conn.lock) return SyncStatus.LOCKED;

  if (conn.lastRun) {
    if (conn.lastRun.status === SyncStatus.SUCCESS) return SyncStatus.SUCCESS;
    if (conn.lastRun.status === SyncStatus.CANCELLED) return SyncStatus.CANCELLED;
    return SyncStatus.FAILED;
  }
  return null;
}

export interface GroupSummary {
  total: number;
  succeeded: number;
  failed: number;
  running: number; // running / queued / locked — anything actively in-flight
  other: number; // cancelled / never-run
}

/**
 * Rollup counts for a source group's connections, used by the group header
 * badge (e.g. "3 connections · 2 succeeded · 1 failed").
 */
export function summarizeGroup(connections: Connection[]): GroupSummary {
  const summary: GroupSummary = {
    total: connections.length,
    succeeded: 0,
    failed: 0,
    running: 0,
    other: 0,
  };
  for (const conn of connections) {
    const status = deriveConnectionStatus(conn);
    if (status === SyncStatus.SUCCESS) summary.succeeded++;
    else if (status === SyncStatus.FAILED) summary.failed++;
    else if (
      status === SyncStatus.RUNNING ||
      status === SyncStatus.QUEUED ||
      status === SyncStatus.LOCKED
    ) {
      summary.running++;
    } else {
      summary.other++;
    }
  }
  return summary;
}
