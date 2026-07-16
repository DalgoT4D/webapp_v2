'use client';

import { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toastError } from '@/lib/toast';
import { getApiErrorStatus } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
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
  /** Display name for the supporting line. Usually unavailable (the fetch
   * just 403'd), so the copy falls back to "this {resourceLabel}". */
  resourceName?: string | null;
  /** Testing seam: jsdom's window.location.reload can't be stubbed, so
   * tests inject a spy. Production callers never pass this. */
  reloadPage?: () => void;
}

/**
 * Full-page substitute for the generic error state on a 403: lets the
 * viewer ask for access instead of dead-ending. Three states — form /
 * just-submitted / already-pending. The outgoing-requests fetch is not
 * view-gated, so it works even though the resource fetch just failed.
 */
export function RequestAccessScreen({
  rtype,
  resourceId,
  resourceLabel,
  resourceName,
  reloadPage = () => window.location.reload(),
}: RequestAccessScreenProps) {
  const { outgoing, isLoading, mutate } = useAccessRequests(true);
  const currentUser = useAuthStore((state) => state.getCurrentOrgUser());
  const [permission, setPermission] = useState<AccessLevel>('view');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Some rtypes reject a Member's request outright with a plain-language
  // 400. That's a permanent answer, not a transient failure — shown inline
  // instead of a toast so it can't be missed or dismissed.
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

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
      // The one 400 that isn't a failure: the caller already has access
      // (a grant landed since page load). Reload re-runs the resource fetch.
      // Gated on status AND message so unrelated errors can't trigger it.
      if (getApiErrorStatus(error) === 400 && /already have access/i.test(message)) {
        reloadPage();
        return;
      }
      // A deliberate, permanent block (e.g. a Member requesting a chart) —
      // rendered inline as an answer. Any other error still toasts.
      if (getApiErrorStatus(error) === 400 && message) {
        setBlockedMessage(message);
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
        ) : blockedMessage ? (
          <div data-testid="request-access-blocked-state" className="space-y-2">
            <h2 className="text-xl font-semibold">Can&apos;t request access</h2>
            <p
              className="text-sm text-muted-foreground"
              data-testid="request-access-blocked-message"
            >
              {blockedMessage}
            </p>
          </div>
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
            {/* Request-access headline + supporting copy */}
            <h2 className="text-xl font-semibold">Request access to this {resourceLabel}</h2>
            <p className="text-sm text-muted-foreground">
              {resourceName
                ? `You can view the "${resourceName}" once your request is approved`
                : `You can view this ${resourceLabel} once your request is approved`}
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

        {currentUser?.email && (
          <p className="text-xs text-muted-foreground" data-testid="request-access-logged-in-as">
            You&apos;re logged in as {currentUser.email}
          </p>
        )}
      </div>
    </div>
  );
}
