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

  const isRead = notification.read_status;

  return (
    <TableRow
      data-testid={`notification-row-${notification.id}`}
      className={cn(isRead ? 'bg-muted hover:bg-muted' : 'bg-card hover:bg-muted/50')}
    >
      <TableCell className="w-12 pl-4 align-top py-4">
        <Checkbox
          data-testid={`notification-checkbox-${notification.id}`}
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(notification.id, checked as boolean)}
          aria-label={`Select notification ${notification.id}`}
          className={cn(
            isRead
              ? 'border-border data-[state=checked]:bg-gray-400 data-[state=checked]:border-gray-400'
              : 'border-gray-800 data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900'
          )}
        />
      </TableCell>

      <TableCell className="w-full py-4 align-top whitespace-normal">
        <p
          className={cn(
            'leading-relaxed text-base break-words whitespace-normal',
            isRead ? 'text-muted-foreground font-normal' : 'text-foreground font-medium'
          )}
        >
          {renderMessageWithLinks(displayMessage)}
        </p>
        <p className={cn('text-sm mt-2', isRead ? 'text-gray-400' : 'text-muted-foreground')}>
          {formatDistanceToNow(new Date(notification.timestamp), {
            addSuffix: true,
          })}
        </p>
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
            className="h-8 w-8 text-gray-400 hover:text-muted-foreground hover:bg-muted"
            aria-label={isExpanded ? 'Collapse message' : 'Expand message'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
