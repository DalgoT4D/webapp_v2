import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import type { Notification } from '@/types/notifications';
import { MESSAGE_TRUNCATE_LENGTH } from '@/constants/notifications';
import { cn } from '@/lib/utils';

interface NotificationRowProps {
  notification: Notification;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (id: number, checked: boolean) => void;
  onToggleExpand: (id: number) => void;
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

  return (
    <TableRow
      data-testid={`notification-row-${notification.id}`}
      className={cn('hover:bg-gray-50', !notification.read_status && 'bg-teal-50/30')}
    >
      <TableCell className="w-12 pl-4 align-top py-4">
        <Checkbox
          data-testid={`notification-checkbox-${notification.id}`}
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(notification.id, checked as boolean)}
          aria-label={`Select notification ${notification.id}`}
        />
      </TableCell>

      <TableCell className="w-full py-4 align-top whitespace-normal">
        <div
          className={cn(
            'transition-colors',
            notification.read_status ? 'text-gray-700' : 'text-gray-900'
          )}
        >
          <p
            className={cn(
              'leading-relaxed text-base break-words whitespace-normal',
              !notification.read_status && 'font-medium'
            )}
          >
            {renderMessageWithLinks(displayMessage)}
          </p>
          <p className="text-base text-gray-600 mt-2">
            {formatDistanceToNow(new Date(notification.timestamp), {
              addSuffix: true,
            })}
          </p>
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
