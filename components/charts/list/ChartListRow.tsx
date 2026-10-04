'use client';

import Link from 'next/link';
import { CheckSquare, Copy, Edit, MoreVertical, Share2, Star, Trash, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Chart } from '@/hooks/api/useCharts';
import { PERMISSIONS, type useRbac } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChartDeleteDialog } from '@/components/charts/ChartDeleteDialog';
import { ChartExportDropdownForList } from '@/components/charts/ChartExportDropdownForList';
import { getChartListIcon, getChartTypeColors } from '@/components/charts/chart-types/registry';
import { getChartDataSource } from './chart-list-logic';

interface ChartListRowProps {
  chart: Chart;
  isSelectionMode: boolean;
  isSelected: boolean;
  isFavoriting: boolean;
  isDuplicating: boolean;
  isDeleting: boolean;
  hasPermission: ReturnType<typeof useRbac>['hasPermission'];
  onToggleFavorite: (chart: Chart) => void;
  onToggleSelection: (chartId: number) => void;
  onEnterSelectionMode: (chartId: number) => void;
  onShare: (chart: Chart) => void;
  onDuplicate: (chartId: number, chartTitle: string) => void;
  onDelete: (chartId: number, chartTitle: string, chartType?: string) => void;
}

/** One chart in the /charts table. */
export function ChartListRow({
  chart,
  isSelectionMode,
  isSelected,
  isFavoriting,
  isDuplicating,
  isDeleting,
  hasPermission,
  onToggleFavorite,
  onToggleSelection,
  onEnterSelectionMode,
  onShare,
  onDuplicate,
  onDelete,
}: ChartListRowProps) {
  // PINNED-BUGS: "Pivot chart type shows the bar icon in the chart list" (registry listIcon)
  const IconComponent = getChartListIcon(chart.chart_type);
  const typeColors = getChartTypeColors(chart.chart_type);
  const isFavorited = chart.is_favorite ?? false;
  const dataSource = getChartDataSource(chart);

  return (
    <TableRow className="hover:bg-gray-50">
      {/* Name Column with Star */}
      <TableCell className="py-4">
        <div className="flex items-center gap-3 min-w-0">
          {isSelectionMode && (
            <Checkbox
              id={`chart-select-${chart.id}`}
              data-testid={`chart-select-checkbox-${chart.id}`}
              aria-label={`Select chart ${chart.title}`}
              checked={isSelected}
              onCheckedChange={() => onToggleSelection(chart.id)}
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0 hover:bg-yellow-50 shrink-0"
            disabled={isFavoriting}
            data-testid={`chart-list-favorite-${chart.id}`}
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite(chart);
            }}
          >
            {isFavorited ? (
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
            ) : (
              <Star className="w-4 h-4 text-gray-300 hover:text-yellow-400" />
            )}
          </Button>
          <div className="flex flex-col gap-1 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={hasPermission(PERMISSIONS.CAN_VIEW_CHARTS) ? `/charts/${chart.id}` : '#'}
                  data-testid={`chart-list-title-link-${chart.id}`}
                  className="font-medium text-lg text-gray-900 hover:text-teal-700 hover:underline truncate"
                >
                  {chart.title}
                </Link>
              </TooltipTrigger>
              <TooltipContent className="max-w-md break-words">{chart.title}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TableCell>

      {/* Data Source Column */}
      <TableCell className="py-4">
        <div className="flex items-center gap-2 min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-base text-gray-700 truncate">{dataSource}</div>
            </TooltipTrigger>
            <TooltipContent className="max-w-md break-words">{dataSource}</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>

      {/* Chart Type Column */}
      <TableCell className="py-4">
        <div className="flex">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 cursor-default"
                  style={{ backgroundColor: typeColors.bgColor }}
                >
                  <IconComponent className="w-6 h-6" style={{ color: typeColors.color }} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-900 text-white border-gray-700">
                <p className="text-sm capitalize">{chart.chart_type} Chart</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </TableCell>

      {/* Created by Column */}
      <TableCell className="py-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
            <User className="w-3 h-3 text-gray-600" />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="text-base text-gray-700 truncate"
                data-testid={`chart-created-by-${chart.id}`}
              >
                {chart.created_by || 'Unknown'}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-md break-words">
              {chart.created_by || 'Unknown'}
            </TooltipContent>
          </Tooltip>
        </div>
      </TableCell>

      {/* Last Modified Column */}
      <TableCell className="py-4 text-base text-gray-600">
        {chart.updated_at
          ? formatDistanceToNow(new Date(chart.updated_at), { addSuffix: true })
          : 'Unknown'}
      </TableCell>

      {/* Actions Column */}
      <TableCell className="py-4">
        <div className="flex items-center gap-2">
          {chart.access_level === 'edit' && (
            <Link href={`/charts/${chart.id}/edit`}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 hover:bg-gray-100"
                data-testid={`chart-list-edit-${chart.id}`}
              >
                <Edit className="w-4 h-4 text-gray-600" />
              </Button>
            </Link>
          )}
          {chart.access_level === 'edit' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0 hover:bg-gray-100"
              onClick={() => onShare(chart)}
              data-testid={`chart-list-share-${chart.id}`}
            >
              <Share2 className="w-4 h-4 text-gray-600" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 hover:bg-gray-100"
                data-testid={`chart-list-row-menu-${chart.id}`}
              >
                <MoreVertical className="w-4 h-4 text-gray-600" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() =>
                  isSelectionMode ? onToggleSelection(chart.id) : onEnterSelectionMode(chart.id)
                }
                className="cursor-pointer"
                data-testid={`chart-list-row-menu-select-${chart.id}`}
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                {isSelected ? 'Deselect' : 'Select'}
              </DropdownMenuItem>
              {hasPermission(PERMISSIONS.CAN_CREATE_CHARTS) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDuplicate(chart.id, chart.title)}
                    className="cursor-pointer"
                    disabled={isDuplicating}
                    data-testid={`chart-list-row-menu-duplicate-${chart.id}`}
                  >
                    {isDuplicating ? (
                      <div className="w-4 h-4 mr-2 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    Duplicate
                  </DropdownMenuItem>
                </>
              )}
              {hasPermission(PERMISSIONS.CAN_VIEW_CHARTS) && (
                // PINNED-BUGS: "List-page CSV export of table charts always fails" (inside ChartExportDropdownForList)
                <ChartExportDropdownForList
                  chartId={chart.id}
                  chartTitle={chart.title}
                  chartType={chart.chart_type}
                />
              )}
              {hasPermission(PERMISSIONS.CAN_DELETE_CHARTS) && (
                <>
                  <DropdownMenuSeparator />
                  <ChartDeleteDialog
                    chartId={chart.id}
                    chartTitle={chart.title}
                    onConfirm={() => onDelete(chart.id, chart.title, chart.chart_type)}
                    isDeleting={isDeleting}
                  >
                    <DropdownMenuItem
                      className="cursor-pointer text-destructive focus:text-destructive"
                      onSelect={(e) => e.preventDefault()}
                      data-testid={`chart-list-row-menu-delete-${chart.id}`}
                    >
                      <Trash className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </ChartDeleteDialog>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
