'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RequestAccessDialog } from '@/components/access/request-access-dialog';

interface RequestEditPillProps {
  rtype: string;
  resourceId: number;
  /** The caller's effective access level on this resource. Only 'view' shows
   *  the pill — Owners, Admins, and effective-Edit users see nothing. */
  resourceAccessLevel: 'view' | 'edit' | undefined | null;
}

/**
 * Persistent pill for View-holders on single-resource pages (dashboards,
 * charts, reports, KPIs). Opens the shared RequestAccessDialog with the
 * level pre-set to Edit.
 */
export function RequestEditPill({ rtype, resourceId, resourceAccessLevel }: RequestEditPillProps) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  if (resourceAccessLevel !== 'view') return null;

  return (
    <>
      <Button
        data-testid="request-edit-pill"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={sent}
        className="text-xs border-green-600 text-green-600 bg-white hover:bg-green-50"
      >
        {sent ? 'Request Edit sent' : 'Request Edit'}
      </Button>

      <RequestAccessDialog
        rtype={rtype}
        resourceId={resourceId}
        defaultLevel="edit"
        lockLevel
        isOpen={open}
        onClose={() => setOpen(false)}
        onSubmitted={() => setSent(true)}
      />
    </>
  );
}
