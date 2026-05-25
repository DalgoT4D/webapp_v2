'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { DashboardMetadataStatusItem } from '@/hooks/api/useDashboardAIChat';

interface DashboardChatMetadataCardProps {
  dashboards: DashboardMetadataStatusItem[];
  readyCount: number;
  totalCount: number;
  lastBuiltAt: string;
  isLoading: boolean;
  isBuildingAll: boolean;
  isBuildingSelected: boolean;
  selectedDashboardId: number | null;
  onBuildAll: () => void | Promise<void>;
  onBuildSelected: () => void | Promise<void>;
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ready':
      return 'default';
    case 'building':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function DashboardChatMetadataCard({
  dashboards,
  readyCount,
  totalCount,
  lastBuiltAt,
  isLoading,
  isBuildingAll,
  isBuildingSelected,
  selectedDashboardId,
  onBuildAll,
  onBuildSelected,
}: DashboardChatMetadataCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle>Dashboard chat metadata</CardTitle>
            <CardDescription>
              Build the dashboard-scoped metadata artifacts used by the new chat runtime.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={onBuildSelected}
              disabled={isLoading || !selectedDashboardId || isBuildingAll || isBuildingSelected}
            >
              {isBuildingSelected ? 'Building selected...' : 'Build selected dashboard'}
            </Button>
            <Button
              variant="outline"
              onClick={onBuildAll}
              disabled={isLoading || isBuildingAll || isBuildingSelected}
            >
              {isBuildingAll ? 'Building all...' : 'Build all dashboards'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 rounded-lg border bg-slate-50 p-4 md:grid-cols-3">
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Ready dashboards:</span> {readyCount} /{' '}
            {totalCount}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Last metadata build:</span> {lastBuiltAt}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Builder model:</span> o4-mini
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dashboard</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tables</TableHead>
              <TableHead>Charts</TableHead>
              <TableHead>Built at</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dashboards.map((dashboard) => (
              <TableRow
                key={dashboard.dashboard_id}
                className={
                  dashboard.dashboard_id === selectedDashboardId ? 'bg-muted/30' : undefined
                }
              >
                <TableCell className="max-w-[240px] whitespace-normal font-medium">
                  {dashboard.dashboard_title}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(dashboard.status)}>{dashboard.status}</Badge>
                </TableCell>
                <TableCell>{dashboard.table_count}</TableCell>
                <TableCell>{dashboard.chart_count}</TableCell>
                <TableCell>{dashboard.built_at || 'Not built yet'}</TableCell>
                <TableCell className="max-w-[320px] whitespace-normal text-xs text-slate-700">
                  {dashboard.error_message || '—'}
                </TableCell>
              </TableRow>
            ))}
            {dashboards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-muted-foreground">
                  No native dashboards found for this organization.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
