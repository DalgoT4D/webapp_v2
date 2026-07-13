'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  MoreVertical,
  Pencil,
  Trash2,
  ListOrdered,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  BellRing,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cronToString, localTimezone } from '@/components/pipeline/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table as TableComponent,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { bandStatement } from '@/lib/kpi-rag';
import { AlertType, type AlertListItem, type KpiRagContext, type RagState } from '@/types/alerts';
import { RAG_COLORS } from '@/types/kpis';
import { CreateAlertTypeModal } from './CreateAlertTypeModal';

const RAG_CHIP_LABEL: Record<RagState, string> = {
  red: 'Red',
  amber: 'Amber',
  green: 'Green',
};

function RagChips({ states, ctx }: { states: RagState[]; ctx: KpiRagContext | null }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {states.map((s) => {
        const colors = RAG_COLORS[s];
        const label = RAG_CHIP_LABEL[s];
        if (!colors) return null;
        const tooltip = ctx ? bandStatement(s, ctx) : `Fires when KPI lands in ${label} band.`;
        return (
          <Tooltip key={s}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'inline-flex cursor-default items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm',
                  colors.bg,
                  colors.text
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', colors.dot)} />
                {label}
              </span>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/**
 * Strip the leading subject (e.g. "value ") so the cell shows just the operator
 * + value. The full statement appears on hover via tooltip.
 */
function minimalCondition(pretty: string): string {
  return pretty.replace(/^value\s+/i, '').trim() || pretty;
}

export type AlertSortKey = 'name' | 'condition' | 'frequency' | 'fire_streak' | 'last_fire_at';
export type SortOrder = 'asc' | 'desc';

interface AlertsTableProps {
  alerts: AlertListItem[];
  isLoading: boolean;
  /** Empty state to render when alerts.length === 0 && !isLoading */
  emptyState: React.ReactNode;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (a: AlertListItem) => void;
  onDelete: (a: AlertListItem) => void;
  onToggle: (a: AlertListItem) => void;
  onOpenLog: (a: AlertListItem) => void;
  /**
   * The `?alertId=` deep-link target (from an access-request/notification
   * email) — highlights the matching row, mirroring metrics-library.tsx's
   * `highlight` param. Only takes effect if the alert is on the currently
   * loaded page; the list is already resolver-scoped, so an alert the
   * viewer can't see never has a row here in the first place (unlike the
   * 403 case, which the page handles before this table even renders).
   */
  highlightAlertId?: string | null;
}

function sourceHref(a: AlertListItem): string | null {
  if (a.source_kind === 'metric' && a.source_id) return `/metrics?highlight=${a.source_id}`;
  if (a.source_kind === 'kpi' && a.source_id) return `/kpis?open=${a.source_id}`;
  return null;
}

function sortAlerts(
  alerts: AlertListItem[],
  sortBy: AlertSortKey,
  order: SortOrder
): AlertListItem[] {
  const sign = order === 'asc' ? 1 : -1;
  return [...alerts].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name) * sign;
      case 'condition':
        return a.condition_pretty.localeCompare(b.condition_pretty) * sign;
      case 'frequency':
        return a.schedule_frequency.localeCompare(b.schedule_frequency) * sign;
      case 'fire_streak':
        return (a.fire_streak - b.fire_streak) * sign;
      case 'last_fire_at': {
        const av = a.last_fire_at ? new Date(a.last_fire_at).getTime() : 0;
        const bv = b.last_fire_at ? new Date(b.last_fire_at).getTime() : 0;
        return (av - bv) * sign;
      }
      default:
        return 0;
    }
  });
}

export function AlertsTable({
  alerts,
  isLoading,
  emptyState,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onToggle,
  onOpenLog,
  highlightAlertId,
}: AlertsTableProps) {
  const [sortBy, setSortBy] = useState<AlertSortKey>('last_fire_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const visible = useMemo(() => sortAlerts(alerts, sortBy, sortOrder), [alerts, sortBy, sortOrder]);

  const toggleSort = (key: AlertSortKey) => {
    if (sortBy === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  const sortIcon = (key: AlertSortKey) => {
    if (sortBy !== key) return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-gray-600" />
    ) : (
      <ChevronDown className="w-4 h-4 text-gray-600" />
    );
  };

  return (
    <div className="border rounded-lg bg-white" data-testid="alerts-table">
      <TableComponent>
        <TableHeader>
          <TableRow className="bg-gray-50">
            {/* Name (sort) */}
            <TableHead className="w-[26%]">
              <Button
                variant="ghost"
                className="h-auto p-0 font-medium text-base hover:bg-transparent"
                onClick={() => toggleSort('name')}
                data-testid="sort-name"
              >
                <span className="flex items-center gap-1">
                  Name
                  {sortIcon('name')}
                </span>
              </Button>
            </TableHead>

            {/* Condition (sort) */}
            <TableHead className="w-[18%]">
              <Button
                variant="ghost"
                className="h-auto p-0 font-medium text-base hover:bg-transparent"
                onClick={() => toggleSort('condition')}
              >
                <span className="flex items-center gap-1">
                  Alert condition
                  {sortIcon('condition')}
                </span>
              </Button>
            </TableHead>

            {/* Enabled */}
            <TableHead className="w-[9%] font-medium text-base">Enabled</TableHead>

            {/* Frequency (sort) */}
            <TableHead className="w-[12%]">
              <Button
                variant="ghost"
                className="h-auto p-0 font-medium text-base hover:bg-transparent"
                onClick={() => toggleSort('frequency')}
              >
                <span className="flex items-center gap-1">
                  Frequency
                  {sortIcon('frequency')}
                </span>
              </Button>
            </TableHead>

            {/* Fire streak (sort) */}
            <TableHead className="w-[10%]">
              <Button
                variant="ghost"
                className="h-auto p-0 font-medium text-base hover:bg-transparent"
                onClick={() => toggleSort('fire_streak')}
              >
                <span className="flex items-center gap-1">
                  Fire streak
                  {sortIcon('fire_streak')}
                </span>
              </Button>
            </TableHead>

            {/* Last fire (sort) */}
            <TableHead className="w-[14%]">
              <Button
                variant="ghost"
                className="h-auto p-0 font-medium text-base hover:bg-transparent"
                onClick={() => toggleSort('last_fire_at')}
                data-testid="sort-last-fire"
              >
                <span className="flex items-center gap-1">
                  Last fire
                  {sortIcon('last_fire_at')}
                </span>
              </Button>
            </TableHead>

            {/* Actions */}
            <TableHead className="w-[10%] font-medium text-base">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <>
              {[0, 1, 2].map((i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </>
          )}
          {!isLoading && visible.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="p-0">
                {emptyState}
              </TableCell>
            </TableRow>
          )}
          {!isLoading &&
            visible.map((a) => {
              const subtitleHref = sourceHref(a);
              return (
                <TableRow
                  key={a.id}
                  className={cn(
                    'hover:bg-gray-50',
                    !a.is_active && 'text-gray-400 hover:bg-gray-50/60',
                    highlightAlertId === String(a.id) && 'bg-primary/5 ring-1 ring-primary/20'
                  )}
                  data-testid={`alert-row-${a.id}`}
                >
                  {/* Name + subtitle */}
                  <TableCell className="py-4">
                    <div className="flex flex-col">
                      <button
                        onClick={() => canEdit && onEdit(a)}
                        className={cn(
                          'font-medium text-lg text-left',
                          canEdit
                            ? 'cursor-pointer hover:text-teal-700 hover:underline'
                            : 'cursor-default',
                          a.is_active ? 'text-gray-900' : 'text-gray-500'
                        )}
                      >
                        {a.name}
                      </button>
                      {a.source_name ? (
                        subtitleHref ? (
                          <Link
                            href={subtitleHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-gray-500 hover:text-teal-700 hover:underline truncate max-w-[260px]"
                          >
                            {a.source_kind === 'kpi' ? 'KPI: ' : 'Metric: '}
                            {a.source_name}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-500 truncate max-w-[260px]">
                            Dataset: {a.source_name}
                          </span>
                        )
                      ) : null}
                    </div>
                  </TableCell>

                  {/* Condition */}
                  <TableCell className="py-4 text-base text-gray-700">
                    {a.alert_type === AlertType.KPI_RAG &&
                    a.rag_states &&
                    a.rag_states.length > 0 ? (
                      <RagChips states={a.rag_states} ctx={a.kpi_rag_context} />
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default">
                            {minimalCondition(a.condition_pretty)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{a.condition_pretty}</TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>

                  {/* Enabled toggle */}
                  <TableCell className="py-4">
                    <span title={canEdit ? '' : 'You need Edit Alerts permission to change this.'}>
                      <Switch
                        checked={a.is_active}
                        onCheckedChange={() => onToggle(a)}
                        disabled={!canEdit}
                        aria-label={`Toggle ${a.name}`}
                      />
                    </span>
                  </TableCell>

                  {/* Frequency */}
                  <TableCell className="py-4 text-base text-gray-700">
                    <div>{cronToString(a.schedule_cron) || a.schedule_frequency}</div>
                    {a.schedule_cron && (
                      <div className="text-sm text-gray-500">{localTimezone()}</div>
                    )}
                  </TableCell>

                  {/* Fire streak */}
                  <TableCell className="py-4 text-base text-gray-700">
                    {a.fire_streak > 0 ? a.fire_streak : <span className="text-gray-400">—</span>}
                  </TableCell>

                  {/* Last fire */}
                  <TableCell className="py-4 text-sm text-gray-500">
                    {a.last_fire_at
                      ? formatDistanceToNow(new Date(a.last_fire_at), { addSuffix: true })
                      : '—'}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="py-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 p-0 hover:bg-gray-100"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-600" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={() => onEdit(a)}
                          disabled={!canEdit}
                          title={canEdit ? '' : 'You need Edit Alerts permission to edit this.'}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onOpenLog(a)}>
                          <ListOrdered className="w-4 h-4 mr-2" />
                          Alert log
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(a)}
                          className="text-destructive focus:text-destructive"
                          disabled={!canDelete}
                          title={
                            canDelete ? '' : 'You need Delete Alerts permission to remove this.'
                          }
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </TableComponent>
    </div>
  );
}

/** Empty-state for the alerts list. */
export function AllAlertsEmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: (type: AlertType) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <BellRing className="w-10 h-10 text-muted-foreground mb-3" />
      <p className="text-base font-medium text-gray-700">No alerts yet</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">
        Get notified when your Metrics, KPIs, or datasets cross a threshold you care about.
      </p>
      {canCreate && (
        <div className="mt-4">
          <CreateAlertTypeModal onSelect={onCreate}>
            <Button data-testid="empty-create-alert">
              <BellRing className="w-4 h-4 mr-2" />
              Create alert
            </Button>
          </CreateAlertTypeModal>
        </div>
      )}
    </div>
  );
}
