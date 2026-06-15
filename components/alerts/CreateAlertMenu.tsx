'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertType } from '@/types/alerts';

interface CreateAlertMenuProps {
  onSelect: (type: AlertType) => void;
  align?: 'start' | 'center' | 'end';
  /** The trigger button — rendered via Radix `asChild`. */
  children: React.ReactNode;
}

export function CreateAlertMenu({ onSelect, align = 'end', children }: CreateAlertMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        style={{ width: 'var(--radix-dropdown-menu-trigger-width)' }}
      >
        <DropdownMenuItem
          onClick={() => onSelect(AlertType.KPI_RAG)}
          data-testid="create-kpi-alert"
        >
          KPI Alerts
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSelect(AlertType.METRIC_THRESHOLD)}
          data-testid="create-metric-alert"
        >
          Metric Alerts
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSelect(AlertType.STANDALONE)}
          data-testid="create-standalone-alert"
        >
          Custom Alerts
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
