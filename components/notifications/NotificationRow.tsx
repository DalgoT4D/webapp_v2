import { useCallback, useState } from 'react';
import { mutate as globalMutate } from 'swr';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import type { Notification } from '@/types/notifications';
import { MESSAGE_TRUNCATE_LENGTH } from '@/constants/notifications';
import { cn } from '@/lib/utils';
import {
  approveAccessRequest,
  declineAccessRequest,
  ACCESS_REQUESTS_KEY,
} from '@/hooks/api/useAccessRequests';
import { toastSuccess, toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface NotificationRowProps {
  notification: Notification;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (id: number, checked: boolean) => void;
  onToggleExpand: (id: number) => void;
}

// The row's local view of an access-request decision, independent of
// read/unread. `alreadyResolved` covers both a decision made elsewhere and
// an expired request — either way, stop offering the buttons.
type AccessRequestDecisionState = 'idle' | 'deciding' | 'approved' | 'denied' | 'alreadyResolved';

// Matches the backend's two 400 messages verbatim — brittle to a backend
// copy change; there is no status-lookup endpoint.
function isAlreadyResolvedError(message: string): boolean {
  return /already been \w+/i.test(message) || /has expired/i.test(message);
}

// Helper to render message with clickable links
function renderMessageWithLinks(message: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = message.split(urlRegex);

  return parts.map((part, index) => {
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-600 hover:text-teal-700 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export function NotificationRow({
  notification,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
}: NotificationRowProps) {
  const isTruncatable = notification.message.length > MESSAGE_TRUNCATE_LENGTH;
  const displayMessage =
    !isExpanded && isTruncatable
      ? notification.message.substring(0, MESSAGE_TRUNCATE_LENGTH) + '...'
      : notification.message;

  const isRead = notification.read_status;

  const accessRequest =
    notification.metadata?.kind === 'access_request' ? notification.metadata : null;
  const [decisionState, setDecisionState] = useState<AccessRequestDecisionState>('idle');

  const handleApprove = useCallback(async () => {
    if (!accessRequest) return;
    setDecisionState('deciding');
    try {
      // Grants exactly what was requested — the row offers no permission
      // picker, so the "escalate above the ask" 400 is unreachable here.
      await approveAccessRequest(accessRequest.request_id);
      setDecisionState('approved');
      globalMutate(ACCESS_REQUESTS_KEY);
      toastSuccess.generic('Access granted');
      trackEvent(ANALYTICS_EVENTS.SHARING_ACCESS_REQUEST_APPROVED, {
        entity_type: accessRequest.resource_type,
        downgraded: false,
        source: 'notification_row',
      });
    } catch (error) {
      if (error instanceof Error && isAlreadyResolvedError(error.message)) {
        setDecisionState('alreadyResolved');
      } else {
        setDecisionState('idle');
        toastError.api(error, 'approve this request');
      }
    }
  }, [accessRequest]);

  const handleDeny = useCallback(async () => {
    if (!accessRequest) return;
    setDecisionState('deciding');
    try {
      await declineAccessRequest(accessRequest.request_id);
      setDecisionState('denied');
      globalMutate(ACCESS_REQUESTS_KEY);
      toastSuccess.generic('Request denied');
      trackEvent(ANALYTICS_EVENTS.SHARING_ACCESS_REQUEST_DECLINED, {
        entity_type: accessRequest.resource_type,
        source: 'notification_row',
      });
    } catch (error) {
      if (error instanceof Error && isAlreadyResolvedError(error.message)) {
        setDecisionState('alreadyResolved');
      } else {
        setDecisionState('idle');
        toastError.api(error, 'deny this request');
      }
    }
  }, [accessRequest]);

  return (
    <TableRow
      data-testid={`notification-row-${notification.id}`}
      className={cn(isRead ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white hover:bg-gray-50/50')}
    >
      <TableCell className="w-12 pl-4 align-top py-4">
        <Checkbox
          data-testid={`notification-checkbox-${notification.id}`}
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(notification.id, checked as boolean)}
          aria-label={`Select notification ${notification.id}`}
          className={cn(
            isRead
              ? 'border-gray-300 data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400'
              : 'border-gray-800 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900'
          )}
        />
      </TableCell>

      <TableCell className="w-full py-4 align-top whitespace-normal">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'leading-relaxed text-base break-words whitespace-normal',
                isRead ? 'text-gray-500 font-normal' : 'text-gray-800 font-medium'
              )}
            >
              {renderMessageWithLinks(displayMessage)}
            </p>
            <p className={cn('text-sm mt-2', isRead ? 'text-gray-400' : 'text-gray-600')}>
              {formatDistanceToNow(new Date(notification.timestamp), {
                addSuffix: true,
              })}
            </p>
          </div>

          {accessRequest && (
            <div
              className="flex flex-shrink-0 items-center gap-2"
              data-testid={`notification-actions-${notification.id}`}
            >
              {decisionState === 'idle' || decisionState === 'deciding' ? (
                <>
                  <Button
                    data-testid={`notification-deny-btn-${notification.id}`}
                    variant="outline"
                    size="sm"
                    disabled={decisionState === 'deciding'}
                    onClick={handleDeny}
                  >
                    DENY
                  </Button>
                  <Button
                    data-testid={`notification-approve-btn-${notification.id}`}
                    variant="primary"
                    size="sm"
                    disabled={decisionState === 'deciding'}
                    onClick={handleApprove}
                  >
                    APPROVE
                  </Button>
                </>
              ) : (
                <span
                  data-testid={`notification-decision-${notification.id}`}
                  className={cn(
                    'text-sm font-medium',
                    decisionState === 'approved' && 'text-teal-700',
                    decisionState === 'denied' && 'text-gray-500',
                    decisionState === 'alreadyResolved' && 'text-muted-foreground'
                  )}
                >
                  {decisionState === 'approved' && 'Approved'}
                  {decisionState === 'denied' && 'Denied'}
                  {decisionState === 'alreadyResolved' && 'Already resolved'}
                </span>
              )}
            </div>
          )}
        </div>
      </TableCell>

      <TableCell className="w-16 text-center align-top py-4">
        {notification.urgent && (
          <AlertCircle className="h-5 w-5 text-red-500 inline-block" aria-label="Urgent" />
        )}
      </TableCell>

      <TableCell className="w-12 pr-4 align-top py-4">
        {isTruncatable && (
          <Button
            data-testid={`notification-expand-btn-${notification.id}`}
            variant="ghost"
            size="icon"
            onClick={() => onToggleExpand(notification.id)}
            className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            aria-label={isExpanded ? 'Collapse message' : 'Expand message'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
