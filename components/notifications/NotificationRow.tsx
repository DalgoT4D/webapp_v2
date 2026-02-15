import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { Notification } from '@/types/notifications';
import { MESSAGE_TRUNCATE_LENGTH } from '@/constants/notifications';

interface NotificationRowProps {
  notification: Notification;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (id: number, checked: boolean) => void;
  onToggleExpand: (id: number) => void;
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
    <TableRow className="hover:bg-gray-50">
      <TableCell className="w-12">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(notification.id, checked as boolean)}
        />
      </TableCell>

      <TableCell>
        <div className={notification.read_status ? 'text-gray-500' : 'text-gray-900'}>
          <p className="font-medium whitespace-pre-wrap">{displayMessage}</p>
          <p className="text-sm text-gray-500 mt-1">
            {formatDistanceToNow(new Date(notification.timestamp), {
              addSuffix: true,
            })}
          </p>
        </div>
      </TableCell>

      <TableCell className="w-20 text-center">
        {notification.urgent && <AlertCircle className="h-5 w-5 text-red-500 inline-block" />}
      </TableCell>

      <TableCell className="w-12">
        {isTruncatable && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleExpand(notification.id)}
            className="h-8 w-8"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
