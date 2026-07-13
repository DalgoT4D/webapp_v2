'use client';

import { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  useAccessRequests,
  createAccessRequest,
  ACCESS_REQUEST_NOTE_MAX_LENGTH,
} from '@/hooks/api/useAccessRequests';
import type { AccessLevel, ShareableResourceType } from '@/hooks/api/useResourceAccess';

const LEVEL_LABELS: Record<AccessLevel, string> = {
  view: 'View',
  edit: 'Edit',
};

interface RequestAccessScreenProps {
  rtype: ShareableResourceType;
  resourceId: number;
  /** Lowercase noun for copy — e.g. "dashboard", "report", "alert". */
  resourceLabel: string;
  /**
   * Testing seam for the "already have access" recovery path. Production
   * callers never pass this — it defaults to a real full-page reload.
   * jsdom's `window.location.reload` is non-configurable and can't be
   * stubbed directly, so tests inject a spy here instead.
   */
  reloadPage?: () => void;
}

/**
 * Full-page substitute for the generic error state when a resource fetch
 * 403s: lets the viewer ask the owner for access instead of dead-ending.
 * Renders one of three states — form / just-submitted / already-pending —
 * driven by a local `submitted` flag (this session) and the caller's own
 * `outgoing` access requests (GET /api/access/requests/, which is NOT
 * view-gated on this resource — it's "any authenticated org member", so it
 * works even though the viewer just failed the view-gated resource fetch).
 */
export function RequestAccessScreen({
  rtype,
  resourceId,
  resourceLabel,
  reloadPage = () => window.location.reload(),
}: RequestAccessScreenProps) {
  const { outgoing, isLoading, mutate } = useAccessRequests(true);
  const [permission, setPermission] = useState<AccessLevel>('view');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const pendingRequest = useMemo(
    () =>
      outgoing.find(
        (r) =>
          r.resource_type === rtype &&
          r.resource_id === String(resourceId) &&
          r.status === 'pending'
      ),
    [outgoing, rtype, resourceId]
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await createAccessRequest(rtype, resourceId, {
        requested_permission: permission,
        note: note.trim() || undefined,
      });
      trackEvent(ANALYTICS_EVENTS.SHARING_ACCESS_REQUESTED, {
        entity_type: rtype,
        requested_permission: permission,
      });
      setSubmitted(true);
      mutate();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      // The only 400 that isn't a real failure: the caller already has
      // access (e.g. a grant landed between page load and this click, or a
      // stale tab). Reloading re-runs the resource fetch, which now
      // succeeds — simplest honest recovery, no bespoke re-fetch plumbing.
      if (/already have access/i.test(message)) {
        reloadPage();
        return;
      }
      toastError.api(error, 'send this request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showPending = submitted || Boolean(pendingRequest);
  const pendingPermission = pendingRequest?.requested_permission ?? permission;

  return (
    <div
      className="h-full flex items-center justify-center p-6"
      data-testid="request-access-screen"
    >
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
          <Lock className="w-6 h-6 text-muted-foreground" />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground" data-testid="request-access-loading">
            Checking access…
          </p>
        ) : showPending ? (
          <div data-testid="request-access-pending-state" className="space-y-2">
            <h2 className="text-xl font-semibold">
              {submitted ? 'Request sent' : 'Request pending'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {submitted
                ? 'The owner has been notified.'
                : `Your request for ${LEVEL_LABELS[pendingPermission]} access is waiting on the owner's decision.`}
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold">
              You don&apos;t have access to this {resourceLabel}
            </h2>
            <p className="text-sm text-muted-foreground">
              Ask the owner for access — they&apos;ll be notified and can approve or decline.
            </p>

            <div className="text-left space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Permission requested</Label>
                <RadioGroup
                  value={permission}
                  onValueChange={(value) => setPermission(value as AccessLevel)}
                  className="flex gap-4"
                  data-testid="request-access-permission"
                >
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem
                      value="view"
                      id="request-access-permission-view"
                      data-testid="request-access-permission-view"
                    />
                    View
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem
                      value="edit"
                      id="request-access-permission-edit"
                      data-testid="request-access-permission-edit"
                    />
                    Edit
                  </label>
                </RadioGroup>
              </div>

              <div className="space-y-1">
                <Label htmlFor="request-access-note" className="text-xs font-medium">
                  Note (optional)
                </Label>
                <Textarea
                  id="request-access-note"
                  data-testid="request-access-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={ACCESS_REQUEST_NOTE_MAX_LENGTH}
                  placeholder="Let the owner know why you need access"
                  rows={3}
                  className="resize-none text-sm"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {note.length}/{ACCESS_REQUEST_NOTE_MAX_LENGTH}
                </p>
              </div>

              <Button
                data-testid="request-access-submit-btn"
                variant="primary"
                className="w-full"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Requesting…' : 'Request access'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
