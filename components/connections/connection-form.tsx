'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { FormMode } from '@/constants/connections';
import { ConnectionFormBody } from './connection-form-body';

interface ConnectionFormProps {
  mode: FormMode;
  connectionId?: string;
  onClose: () => void;
  onSuccess: () => void;
  // When creating a connection from within a specific source (e.g. the Ingest
  // source row's "Add connection"), the source is fixed: it is preselected and
  // the source picker is locked so it cannot be changed.
  lockedSourceId?: string;
}

// Standalone dialog wrapper around ConnectionFormBody — used everywhere the
// connection create/edit/view form is opened as a modal. The add-source
// wizard's step 3 renders ConnectionFormBody directly instead, without this
// Dialog wrapper, so it can sit inside the wizard's own shell.
export function ConnectionForm({
  mode,
  connectionId,
  onClose,
  onSuccess,
  lockedSourceId,
}: ConnectionFormProps) {
  const isCreate = mode === FormMode.CREATE;
  const isView = mode === FormMode.VIEW;
  // Stay compact until streams are discovered (same as the wizard), then widen
  // to fit the streams table alongside the help panel.
  const [expanded, setExpanded] = useState(false);
  // Custom sources (Sheets/Kobo) report their name + stream noun so the header
  // reads the same way as the wizard's connection step (source-named title +
  // "select which <forms/sheets> to sync"). Null → generic fallback copy.
  const [headerInfo, setHeaderInfo] = useState<{
    sourceName: string;
    streamNoun: string;
  } | null>(null);

  const sourceName = headerInfo?.sourceName;
  const streamNoun = headerInfo?.streamNoun?.toLowerCase();
  const title = isCreate
    ? sourceName
      ? `Connect ${sourceName}`
      : 'New Connection'
    : isView
      ? sourceName
        ? `${sourceName} connection`
        : 'View Connection'
      : sourceName
        ? `Edit ${sourceName} connection`
        : 'Edit Connection';
  const description = isCreate
    ? streamNoun
      ? `Choose which ${streamNoun} to sync from this source into your warehouse.`
      : 'Set up a new data connection.'
    : isView
      ? streamNoun
        ? `Viewing which ${streamNoun} sync into your warehouse (read-only during a sync).`
        : 'Connection details (read-only while syncing).'
      : streamNoun
        ? `Update which ${streamNoun} sync into your warehouse.`
        : 'Update your connection settings.';

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className={cn(
          'max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden transition-[max-width,width] duration-300 ease-out',
          expanded ? '!max-w-[1600px] !w-[96vw]' : '!max-w-[720px] !w-[92vw]'
        )}
        preventOutsideClose
      >
        <DialogHeader className="flex-shrink-0 space-y-2 px-6 pt-6 pb-4 border-b text-left">
          <DialogTitle className="text-2xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-base">{description}</DialogDescription>
        </DialogHeader>

        <ConnectionFormBody
          mode={mode}
          connectionId={connectionId}
          lockedSourceId={lockedSourceId}
          onSuccess={onSuccess}
          onCancel={onClose}
          onExpandedChange={setExpanded}
          onHeaderInfoChange={setHeaderInfo}
        />
      </DialogContent>
    </Dialog>
  );
}
