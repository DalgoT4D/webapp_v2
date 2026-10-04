'use client';

import { User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { respondToAccessRequest, type AccessRequestRow } from '@/hooks/api/useAccess';

interface AccessRequestsListProps {
  rtype: string;
  entityId: number;
  requests: AccessRequestRow[];
  onRequestsChanged: () => void;
  onGrantsChanged: () => void;
}

/** Pending access requests, at the top so an owner/Edit-holder sees them as soon as the modal opens. */
export function AccessRequestsList({
  rtype,
  entityId,
  requests,
  onRequestsChanged,
  onGrantsChanged,
}: AccessRequestsListProps) {
  return (
    <div className="border border-input rounded-md divide-y bg-background">
      {requests.map((req) => (
        <div
          key={req.id}
          className="px-3 py-2 flex items-center gap-3"
          data-testid={`access-request-row-${req.id}`}
        >
          <span className="inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-full bg-muted text-muted-foreground">
            <UserIcon className="h-4 w-4" />
          </span>
          <p className="text-sm text-foreground flex-1 min-w-0 truncate">
            <span className="font-medium">{req.requester_email}</span> wants to{' '}
            <span className="font-semibold">{req.requested_level}</span>
            {req.note ? <span className="text-muted-foreground"> — {req.note}</span> : null}
          </p>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              data-testid={`access-request-deny-${req.id}`}
              onClick={async () => {
                await respondToAccessRequest(rtype, entityId, req.id, 'declined');
                onRequestsChanged();
              }}
            >
              Deny
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="h-7 text-xs"
              data-testid={`access-request-approve-${req.id}`}
              onClick={async () => {
                await respondToAccessRequest(
                  rtype,
                  entityId,
                  req.id,
                  'approved',
                  req.requested_level
                );
                onRequestsChanged();
                onGrantsChanged();
              }}
            >
              Approve
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
