'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RequestAccessDialog } from '@/components/access/request-access-dialog';

interface NoAccessProps {
  /** When provided, shows a "Request Access" button. */
  rtype?: string;
  resourceId?: number;
}

export function NoAccess({ rtype, resourceId }: NoAccessProps = {}) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const canRequest = !!rtype && resourceId != null;

  return (
    <>
      <div data-testid="no-access" className="h-full flex items-center justify-center bg-muted/30">
        <div className="text-center max-w-sm">
          <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-destructive" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-4">
            {sent
              ? 'Your access request has been sent. The owner will review it.'
              : "You don't have permission to view this. Contact your org Admin or request access."}
          </p>
          {canRequest && !sent && (
            <Button variant="primary" onClick={() => setRequestOpen(true)}>
              Request Access
            </Button>
          )}
        </div>
      </div>

      {canRequest && (
        <RequestAccessDialog
          rtype={rtype!}
          resourceId={resourceId!}
          defaultLevel="view"
          isOpen={requestOpen}
          onClose={() => setRequestOpen(false)}
          onSubmitted={() => setSent(true)}
        />
      )}
    </>
  );
}
