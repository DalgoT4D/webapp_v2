'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  refreshConnectionCatalog,
  scheduleSchemaUpdate,
  useTaskProgress,
} from '@/hooks/api/useConnections';
import { toastSuccess, toastError } from '@/lib/toast';
import {
  CatalogTransformType,
  FieldTransformType,
  SCHEMA_CHANGE_BREAKING,
} from '@/constants/connections';
import type { CatalogDiff, StreamTransform } from '@/types/connections';

interface SchemaChangeFormProps {
  connectionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function SchemaChangeForm({ connectionId, onClose, onSuccess }: SchemaChangeFormProps) {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [catalogDiff, setCatalogDiff] = useState<CatalogDiff | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasBreakingChanges, setHasBreakingChanges] = useState(false);

  const { progress, isComplete, isFailed } = useTaskProgress(taskId);

  // Start catalog refresh on mount
  useEffect(() => {
    refreshConnectionCatalog(connectionId)
      .then((result) => setTaskId(result.task_id))
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to start schema refresh';
        setError(message);
      });
  }, [connectionId]);

  // Handle task completion
  useEffect(() => {
    if (isComplete && progress) {
      const result = progress.result as
        | {
            catalogDiff?: CatalogDiff;
            schemaChange?: string;
          }
        | undefined;
      if (result?.catalogDiff) {
        setCatalogDiff(result.catalogDiff);
      }
      if (result?.schemaChange === SCHEMA_CHANGE_BREAKING) {
        setHasBreakingChanges(true);
      }
    }
    if (isFailed) {
      const message = progress?.message;
      setError(
        typeof message === 'string' && message.length > 0
          ? message
          : 'Failed to fetch schema changes'
      );
    }
  }, [isComplete, isFailed, progress]);

  const transforms = useMemo(() => catalogDiff?.transforms ?? [], [catalogDiff]);

  const handleAccept = useCallback(async () => {
    if (!catalogDiff) return;
    setIsSubmitting(true);
    try {
      await scheduleSchemaUpdate(connectionId, { catalogDiff });
      toastSuccess.generic('Schema changes accepted');
      onSuccess();
    } catch (err) {
      toastError.api(err, 'Failed to accept schema changes');
    } finally {
      setIsSubmitting(false);
    }
  }, [connectionId, catalogDiff, onSuccess]);

  // Group transforms by type for sectioned display
  const groupedTransforms = useMemo(() => {
    const removed = transforms.filter(
      (t) => t.transformType === CatalogTransformType.REMOVE_STREAM
    );
    const added = transforms.filter((t) => t.transformType === CatalogTransformType.ADD_STREAM);
    const updated = transforms.filter(
      (t) => t.transformType === CatalogTransformType.UPDATE_STREAM
    );
    return { removed, added, updated };
  }, [transforms]);

  const isLoading = taskId !== null && !isComplete && !isFailed;

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[80vw] max-h-[85vh] overflow-y-auto" preventOutsideClose>
        <DialogHeader>
          <DialogTitle>Schema Changes</DialogTitle>
          <DialogDescription>
            Review and accept the schema changes detected for this connection. Accepting the schema
            changes will not trigger a clear &amp; resync of the connection. You are free to do this
            manually but in most cases you will not need to.
          </DialogDescription>
        </DialogHeader>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Refreshing schema...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        {/* Changes list — grouped by type */}
        {!isLoading && transforms.length > 0 && (
          <div className="space-y-4" data-testid="schema-changes-list">
            {/* Tables Removed */}
            {groupedTransforms.removed.length > 0 && (
              <div data-testid="schema-section-removed">
                <h4 className="text-sm font-semibold mb-2">Tables Removed</h4>
                <div className="space-y-2">
                  {groupedTransforms.removed.map((transform, idx) => (
                    <div
                      key={`removed-${transform.streamDescriptor.name}-${idx}`}
                      className="flex items-center gap-2 rounded-md border px-3 py-2"
                      data-testid={`schema-transform-removed-${idx}`}
                    >
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                        - REMOVE
                      </span>
                      <span className="text-sm font-mono">
                        {transform.streamDescriptor.namespace
                          ? `${transform.streamDescriptor.namespace}.`
                          : ''}
                        {transform.streamDescriptor.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tables Added */}
            {groupedTransforms.added.length > 0 && (
              <div data-testid="schema-section-added">
                <h4 className="text-sm font-semibold mb-2">Tables Added</h4>
                <div className="space-y-2">
                  {groupedTransforms.added.map((transform, idx) => (
                    <div
                      key={`added-${transform.streamDescriptor.name}-${idx}`}
                      className="flex items-center gap-2 rounded-md border px-3 py-2"
                      data-testid={`schema-transform-added-${idx}`}
                    >
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                        + ADD
                      </span>
                      <span className="text-sm font-mono">
                        {transform.streamDescriptor.namespace
                          ? `${transform.streamDescriptor.namespace}.`
                          : ''}
                        {transform.streamDescriptor.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tables Updated — with field-level details */}
            {groupedTransforms.updated.length > 0 && (
              <div data-testid="schema-section-updated">
                <h4 className="text-sm font-semibold mb-2">Tables Updated</h4>
                <div className="space-y-3">
                  {groupedTransforms.updated.map((transform, idx) => (
                    <div
                      key={`updated-${transform.streamDescriptor.name}-${idx}`}
                      className="rounded-md border"
                      data-testid={`schema-transform-updated-${idx}`}
                    >
                      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          ~ UPDATE
                        </span>
                        <span className="text-sm font-mono">
                          {transform.streamDescriptor.namespace
                            ? `${transform.streamDescriptor.namespace}.`
                            : ''}
                          {transform.streamDescriptor.name}
                        </span>
                      </div>
                      {transform.updateStream && transform.updateStream.length > 0 && (
                        <div className="px-3 py-2 space-y-1">
                          {transform.updateStream.map(
                            (field: StreamTransform, fieldIdx: number) => (
                              <div
                                key={`field-${field.fieldName?.[0] ?? fieldIdx}-${fieldIdx}`}
                                className="flex items-center gap-2 text-sm"
                                data-testid={`schema-field-${idx}-${fieldIdx}`}
                              >
                                <span
                                  className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                                    field.transformType === FieldTransformType.ADD_FIELD
                                      ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                                      : field.transformType === FieldTransformType.REMOVE_FIELD
                                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                  }`}
                                >
                                  {field.transformType === FieldTransformType.ADD_FIELD
                                    ? '+ add'
                                    : field.transformType === FieldTransformType.REMOVE_FIELD
                                      ? '- remove'
                                      : '~ update'}
                                </span>
                                <span className="font-mono text-muted-foreground">
                                  {field.fieldName?.[0] ?? 'unknown'}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Breaking changes warning */}
            {hasBreakingChanges && (
              <div
                className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
                data-testid="breaking-changes-warning"
              >
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Breaking schema changes detected. These changes cannot be automatically accepted.
                  Please review and resolve them manually.
                </span>
              </div>
            )}
          </div>
        )}

        {!isLoading && transforms.length === 0 && !error && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No schema changes detected.
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="uppercase"
            onClick={handleAccept}
            disabled={isLoading || isSubmitting || transforms.length === 0 || hasBreakingChanges}
            data-testid="accept-schema-changes-btn"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Accept Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
