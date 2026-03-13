'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { FileText, Filter, MoreVertical, Plus, Trash2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toastSuccess, toastError } from '@/lib/toast';
import { useSnapshots, deleteSnapshot } from '@/hooks/api/useReports';
import type { ReportSnapshot } from '@/types/reports';
import { CreateSnapshotDialog } from '@/components/reports/create-snapshot-dialog';
import { formatCreatedOn } from '@/components/reports/utils';

// Debounce delay in ms before sending filter to API
const FILTER_DEBOUNCE_MS = 400;

export default function ReportsPage() {
  const router = useRouter();
  const { confirm, DialogComponent: DeleteDialog } = useConfirmationDialog();

  // Filter input states (what the user types)
  const [titleFilter, setTitleFilter] = useState('');
  const [dashboardFilter, setDashboardFilter] = useState('');
  const [createdByFilter, setCreatedByFilter] = useState('');

  // Debounced filter values (what gets sent to the API)
  const [debouncedTitle, setDebouncedTitle] = useState('');
  const [debouncedDashboard, setDebouncedDashboard] = useState('');
  const [debouncedCreatedBy, setDebouncedCreatedBy] = useState('');

  // Debounce filter inputs
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedTitle(titleFilter);
      setDebouncedDashboard(dashboardFilter);
      setDebouncedCreatedBy(createdByFilter);
    }, FILTER_DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [titleFilter, dashboardFilter, createdByFilter]);

  // Build filter params — only include non-empty values
  const filterParams =
    debouncedTitle || debouncedDashboard || debouncedCreatedBy
      ? {
          search: debouncedTitle || undefined,
          dashboard_title: debouncedDashboard || undefined,
          created_by: debouncedCreatedBy || undefined,
        }
      : undefined;

  const { snapshots, isLoading, mutate } = useSnapshots(filterParams);

  // Filter popover open states
  const [openFilters, setOpenFilters] = useState({
    title: false,
    dashboard: false,
    createdBy: false,
  });

  const hasAnyFilter = titleFilter !== '' || dashboardFilter !== '' || createdByFilter !== '';

  const hasActiveFilter = (column: 'title' | 'dashboard' | 'createdBy') => {
    switch (column) {
      case 'title':
        return titleFilter !== '';
      case 'dashboard':
        return dashboardFilter !== '';
      case 'createdBy':
        return createdByFilter !== '';
      default:
        return false;
    }
  };

  const renderFilterIcon = (column: 'title' | 'dashboard' | 'createdBy') => {
    const isActive = hasActiveFilter(column);
    return (
      <div className="relative">
        <Filter
          className={cn(
            'w-4 h-4 transition-colors',
            isActive ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
          )}
        />
        {isActive && <div className="absolute -top-1 -right-1 w-2 h-2 bg-teal-600 rounded-full" />}
      </div>
    );
  };

  const handleDelete = useCallback(
    async (snapshot: ReportSnapshot) => {
      const confirmed = await confirm({
        title: 'Delete report?',
        description: `This will permanently delete "${snapshot.title}". This action cannot be undone.`,
        confirmText: 'Delete',
        type: 'warning',
      });
      if (!confirmed) return;
      try {
        await deleteSnapshot(snapshot.id);
        mutate();
        toastSuccess.deleted('Report');
      } catch (error) {
        toastError.delete(error, 'report');
      }
    },
    [mutate, confirm]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between mb-6 p-6 pb-0">
          <div>
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground mt-1">Create And Manage Your Reports</p>
          </div>
          <CreateSnapshotDialog
            onCreated={() => mutate()}
            trigger={
              <Button
                data-testid="create-report-btn"
                variant="ghost"
                className="text-white hover:opacity-90 shadow-xs"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <Plus className="h-4 w-4 mr-2" /> Create Report
              </Button>
            }
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 mt-6">
        <div className="h-full overflow-y-auto">
          {isLoading && !hasAnyFilter ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : snapshots.length === 0 && !hasAnyFilter ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No reports yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Create a report from any dashboard
              </p>
              <CreateSnapshotDialog
                onCreated={() => mutate()}
                trigger={
                  <Button data-testid="create-first-report-btn" variant="outline">
                    <Plus className="h-4 w-4 mr-1" /> Create Your First Report
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {/* Title column with filter */}
                    <th className="text-left text-sm font-semibold px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span>Title</span>
                        <Popover
                          open={openFilters.title}
                          onOpenChange={(open) =>
                            setOpenFilters((prev) => ({ ...prev, title: open }))
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0 hover:bg-gray-100"
                            >
                              {renderFilterIcon('title')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72" align="start">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-sm">Filter by Title</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setTitleFilter('')}
                                  className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
                                >
                                  Clear
                                </Button>
                              </div>
                              <Input
                                data-testid="report-filter-title"
                                placeholder="Search report titles..."
                                value={titleFilter}
                                onChange={(e) => setTitleFilter(e.target.value)}
                                className="h-8"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </th>

                    {/* Dashboard Used column with filter */}
                    <th className="text-left text-sm font-semibold px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span>Dashboard Used</span>
                        <Popover
                          open={openFilters.dashboard}
                          onOpenChange={(open) =>
                            setOpenFilters((prev) => ({ ...prev, dashboard: open }))
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0 hover:bg-gray-100"
                            >
                              {renderFilterIcon('dashboard')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72" align="start">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-sm">Filter by Dashboard</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDashboardFilter('')}
                                  className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
                                >
                                  Clear
                                </Button>
                              </div>
                              <Input
                                data-testid="report-filter-dashboard"
                                placeholder="Search dashboard names..."
                                value={dashboardFilter}
                                onChange={(e) => setDashboardFilter(e.target.value)}
                                className="h-8"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </th>

                    {/* Created by column with filter */}
                    <th className="text-left text-sm font-semibold px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span>Created by</span>
                        <Popover
                          open={openFilters.createdBy}
                          onOpenChange={(open) =>
                            setOpenFilters((prev) => ({ ...prev, createdBy: open }))
                          }
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 p-0 hover:bg-gray-100"
                            >
                              {renderFilterIcon('createdBy')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72" align="start">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-medium text-sm">Filter by Creator</h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setCreatedByFilter('')}
                                  className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
                                >
                                  Clear
                                </Button>
                              </div>
                              <Input
                                data-testid="report-filter-creator"
                                placeholder="Search by email..."
                                value={createdByFilter}
                                onChange={(e) => setCreatedByFilter(e.target.value)}
                                className="h-8"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </th>

                    <th className="text-left text-sm font-semibold px-6 py-3">Created on</th>
                    <th className="text-right text-sm font-semibold px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-8 text-center text-sm text-muted-foreground"
                      >
                        No reports match the current filters
                      </td>
                    </tr>
                  ) : (
                    snapshots.map((snapshot: ReportSnapshot) => (
                      <tr
                        key={snapshot.id}
                        data-testid={`report-row-${snapshot.id}`}
                        className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => router.push(`/reports/${snapshot.id}`)}
                      >
                        <td className="px-6 py-4 text-sm">{snapshot.title}</td>
                        <td className="px-6 py-4 text-sm">{snapshot.dashboard_title || '—'}</td>
                        <td className="px-6 py-4 text-sm">
                          {snapshot.created_by && (
                            <span className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {snapshot.created_by}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {formatCreatedOn(snapshot.created_at)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  data-testid={`report-actions-${snapshot.id}`}
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Report actions"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  data-testid={`report-view-${snapshot.id}`}
                                  onClick={() => router.push(`/reports/${snapshot.id}`)}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Report
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  data-testid={`report-delete-${snapshot.id}`}
                                  onClick={() => handleDelete(snapshot)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <DeleteDialog />
    </div>
  );
}
