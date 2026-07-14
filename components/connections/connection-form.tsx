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

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className={cn(
          'max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden transition-[max-width,width] duration-300 ease-out',
          expanded ? '!max-w-[1600px] !w-[96vw]' : '!max-w-[720px] !w-[92vw]'
        )}
        preventOutsideClose
      >
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle>
            {isCreate ? 'New Connection' : isView ? 'View Connection' : 'Edit Connection'}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? 'Set up a new data connection.'
              : isView
                ? 'Connection details (read-only while syncing).'
                : 'Update your connection settings.'}
          </DialogDescription>
        </DialogHeader>

        <ConnectionFormBody
          mode={mode}
          connectionId={connectionId}
          lockedSourceId={lockedSourceId}
          onSuccess={onSuccess}
          onCancel={onClose}
          onExpandedChange={setExpanded}
        />
      </DialogContent>
    </Dialog>
  );
}
