'use client';

import { Plug, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PERMISSIONS, useRbac } from '@/lib/rbac';

interface EmptySourceCardProps {
  /** Open the add-source wizard. Owned by IngestView (a stable top-level sibling)
   *  rather than this card, so it survives the NO_SOURCE → STEADY state flip that
   *  unmounts this card once the first source lands in the cache. */
  onAddSource: () => void;
}

/**
 * Step 2 of the progressive reveal: the org has a warehouse but no sources.
 * Shows a single card explaining what a source is, with one action that opens
 * the shared wizard.
 */
export function EmptySourceCard({ onAddSource }: EmptySourceCardProps) {
  const { hasPermission } = useRbac();
  const canCreate = hasPermission(PERMISSIONS.CAN_CREATE_SOURCE);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-full px-6 py-12"
      data-testid="ingest-empty-source"
    >
      <div className="w-full max-w-md flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Plug className="h-8 w-8 text-primary" />
        </div>
        <h2 className="mt-6 text-2xl font-bold text-foreground">Add your first source</h2>
        <p className="mt-2 text-base text-muted-foreground">
          A source is where your data comes from — a form tool, a spreadsheet, or a database. Add
          one, then create connections to sync it into your warehouse.
        </p>
        <Button
          variant="primary"
          className="uppercase mt-6"
          onClick={onAddSource}
          disabled={!canCreate}
          data-testid="add-first-source-btn"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Source
        </Button>
        {!canCreate && (
          <p className="mt-3 text-sm text-muted-foreground">
            You don&apos;t have permission to add a source. Ask an admin.
          </p>
        )}
      </div>
    </div>
  );
}
