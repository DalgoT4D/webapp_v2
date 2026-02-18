'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  CheckCircle2,
  XCircle,
  Lock,
  Loader2,
  MoreHorizontal,
  History,
  Play,
  Pencil,
  Trash2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import FlowIcon from '@/assets/icons/flow';
import { Button } from '@/components/ui/button';
import {
  Table,
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toastSuccess, toastError } from '@/lib/toast';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { usePipelines, deletePipeline, triggerPipelineRun } from '@/hooks/api/usePipelines';
import { Pipeline } from '@/types/pipeline';
import {
  cronToString,
  lastRunTime,
  localTimezone,
  getFlowRunStartedBy,
  trimEmail,
} from '@/lib/pipeline-utils';
import { useSyncLock } from '@/hooks/useSyncLock';
import { PipelineRunHistory } from './pipeline-run-history';
import { cn } from '@/lib/utils';

export function PipelineList() {
  const router = useRouter();
  const { hasPermission } = useUserPermissions();
  const { pipelines, isLoading, mutate } = usePipelines();
  const { confirm, DialogComponent } = useConfirmationDialog();

  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  // Permissions
  const canViewPipeline = hasPermission('can_view_pipeline');
  const canCreatePipeline = hasPermission('can_create_pipeline');
  const canRunPipeline = hasPermission('can_run_pipeline');
  const canEditPipeline = hasPermission('can_edit_pipeline');
  const canDeletePipeline = hasPermission('can_delete_pipeline');

  const handleViewHistory = useCallback((pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
    setShowHistoryDialog(true);
  }, []);

  const handleRun = useCallback(
    async (deploymentId: string) => {
      try {
        await triggerPipelineRun(deploymentId);
        toastSuccess.generic('Pipeline started successfully');
        mutate();
        return {};
      } catch (error: any) {
        toastError.api(error, 'Failed to run pipeline');
        return { error: 'ERROR' };
      }
    },
    [mutate]
  );

  const handleEdit = useCallback(
    (deploymentId: string) => {
      router.push(`/orchestrate/${deploymentId}/edit`);
    },
    [router]
  );

  const handleDelete = useCallback(
    async (deploymentId: string) => {
      const confirmed = await confirm({
        title: 'Delete Pipeline',
        description:
          'This will permanently delete the pipeline, including its schedule and run history. This action cannot be undone.',
        type: 'warning',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      });

      if (confirmed) {
        try {
          const result = await deletePipeline(deploymentId);
          if (result?.success) {
            toastSuccess.deleted('Pipeline');
            mutate();
          } else {
            toastError.api(null, 'Something went wrong');
          }
        } catch (error: any) {
          toastError.delete(error);
        }
      }
    },
    [confirm, mutate]
  );

  const handleCreate = useCallback(() => {
    router.push('/orchestrate/create');
  }, [router]);

  if (isLoading) {
    return <PipelineListSkeleton />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Pipelines</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your data sync and transformation workflows
            </p>
          </div>
          {canCreatePipeline && (
            <Button onClick={handleCreate} className="h-10" data-testid="create-pipeline-btn">
              <Plus className="h-4 w-4 mr-2" />
              Create Pipeline
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6">
        <div className="h-full overflow-y-auto">
          {pipelines.length === 0 ? (
            <EmptyState canCreate={canCreatePipeline} onCreate={handleCreate} />
          ) : (
            <div className="bg-white rounded-lg border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="text-sm font-semibold text-gray-700">Pipeline</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-700">Schedule</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-700">Status</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-700">Last Run</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-700">Result</TableHead>
                    <TableHead className="text-sm font-semibold text-gray-700 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pipelines.map((pipeline) => (
                    <PipelineRow
                      key={pipeline.deploymentId}
                      pipeline={pipeline}
                      onViewHistory={handleViewHistory}
                      onRun={handleRun}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      canViewPipeline={canViewPipeline}
                      canRunPipeline={canRunPipeline}
                      canEditPipeline={canEditPipeline}
                      canDeletePipeline={canDeletePipeline}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <DialogComponent />

      {showHistoryDialog && selectedPipeline && (
        <PipelineRunHistory
          pipeline={selectedPipeline}
          open={showHistoryDialog}
          onOpenChange={setShowHistoryDialog}
        />
      )}
    </div>
  );
}

interface PipelineRowProps {
  pipeline: Pipeline;
  onViewHistory: (pipeline: Pipeline) => void;
  onRun: (deploymentId: string) => Promise<{ error?: string } | void>;
  onEdit: (deploymentId: string) => void;
  onDelete: (deploymentId: string) => void;
  canViewPipeline: boolean;
  canRunPipeline: boolean;
  canEditPipeline: boolean;
  canDeletePipeline: boolean;
}

function PipelineRow({
  pipeline,
  onViewHistory,
  onRun,
  onEdit,
  onDelete,
  canViewPipeline,
  canRunPipeline,
  canEditPipeline,
  canDeletePipeline,
}: PipelineRowProps) {
  const { name, cron, status, lock, lastRun, deploymentId } = pipeline;
  const { tempSyncState, setTempSyncState } = useSyncLock(lock);

  const isLocked = !!lock;
  const isRunning = lock?.status === 'running' || lock?.status === 'queued' || tempSyncState;
  const isDisabled = isLocked || tempSyncState;

  const handleRunClick = async () => {
    setTempSyncState(true);
    const result = await onRun(deploymentId);
    if (result?.error) {
      setTempSyncState(false);
    }
  };

  // Determine run status
  // locked (optimistic + backend) → queued → running → success/failed
  const getRunStatus = () => {
    if (lock?.status === 'running') return 'running';
    if (lock?.status === 'queued') return 'queued';
    if (lock?.status === 'locked' || lock?.status === 'complete') return 'locked';
    if (tempSyncState) return 'locked';
    if (!lastRun) return null;
    if (lastRun.state_name === 'DBT_TEST_FAILED') return 'warning';
    if (lastRun.status === 'COMPLETED') return 'success';
    return 'failed';
  };

  const runStatus = getRunStatus();

  // Last run display
  const lastRunInfo = useMemo(() => {
    if (isRunning && lock) {
      return {
        time: lastRunTime(lock.lockedAt),
        by: trimEmail(lock.lockedBy),
        isRunning: true,
      };
    }
    if (lastRun) {
      const startedBy = getFlowRunStartedBy(lastRun.startTime || null, lastRun.orguser || 'System');
      return {
        time: lastRunTime(lastRun.startTime || lastRun.expectedStartTime),
        by: startedBy,
        isRunning: false,
      };
    }
    return null;
  }, [lock, lastRun, isRunning]);

  return (
    <TableRow className="hover:bg-gray-50/50" data-testid={`pipeline-row-${deploymentId}`}>
      {/* Pipeline Name */}
      <TableCell className="py-4">
        <div className="flex items-center gap-3">
          <FlowIcon className="h-10 w-10 rounded-lg" bgColor={status ? '#369B44' : '#9CA3AF'} />
          <span
            className="font-medium text-[15px] text-gray-900"
            data-testid={`pipeline-name-${deploymentId}`}
          >
            {name}
          </span>
        </div>
      </TableCell>

      {/* Schedule */}
      <TableCell className="py-4">
        <div className="text-[15px] text-gray-700">
          <span>{cron ? cronToString(cron) : 'Manual'}</span>
        </div>
        {cron && <span className="text-xs text-gray-400">{localTimezone()}</span>}
      </TableCell>

      {/* Pipeline Status */}
      <TableCell className="py-4">
        <Badge
          variant={status ? 'default' : 'secondary'}
          data-testid={`status-badge-${deploymentId}`}
          className={cn(
            'text-[13px] min-w-[70px] justify-center',
            status
              ? 'bg-green-100 text-green-700 hover:bg-green-100'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-100'
          )}
        >
          {status ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>

      {/* Last Run */}
      <TableCell className="py-4">
        {lastRunInfo ? (
          <div>
            <span
              className={cn(
                'text-[15px]',
                lastRunInfo.isRunning ? 'text-amber-600 font-medium' : 'text-gray-700'
              )}
            >
              {lastRunInfo.time}
            </span>
            {lastRunInfo.by && (
              <div className="text-xs text-gray-500 mt-0.5">
                by{' '}
                <span
                  className={cn(
                    lastRunInfo.by === 'System' ? 'text-gray-600' : 'text-primary font-medium'
                  )}
                >
                  {lastRunInfo.by}
                </span>
              </div>
            )}
          </div>
        ) : (
          <span className="text-[15px] text-gray-400">—</span>
        )}
      </TableCell>

      {/* Last Run Status */}
      <TableCell className="py-4">
        <StatusBadge status={runStatus} deploymentId={deploymentId} />
      </TableCell>

      {/* Actions */}
      <TableCell className="py-4">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewHistory(pipeline)}
            disabled={!canViewPipeline}
            className="h-9 px-3 text-[14px] text-gray-600 hover:text-gray-900"
            data-testid={`history-btn-${deploymentId}`}
          >
            <History className="h-4 w-4 mr-1.5" />
            History
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleRunClick}
            disabled={isDisabled || !canRunPipeline}
            data-testid={`run-btn-${deploymentId}`}
            className={cn(
              'h-9 text-[14px] min-w-[72px]',
              isRunning ? 'bg-primary/70 hover:bg-primary/70 cursor-not-allowed px-4' : 'px-4'
            )}
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Run
              </>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isDisabled}
                className="h-9 w-9 p-0 text-gray-400 hover:text-gray-600"
                data-testid={`more-btn-${deploymentId}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {canEditPipeline && (
                <DropdownMenuItem
                  onClick={() => onEdit(deploymentId)}
                  className="text-[14px]"
                  data-testid={`edit-menu-item-${deploymentId}`}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {canDeletePipeline && (
                <DropdownMenuItem
                  onClick={() => onDelete(deploymentId)}
                  className="text-[14px] text-red-600 focus:text-red-600 focus:bg-red-50"
                  data-testid={`delete-menu-item-${deploymentId}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

function StatusBadge({ status, deploymentId }: { status: string | null; deploymentId: string }) {
  if (!status) {
    return (
      <span className="text-[15px] text-gray-400" data-testid={`run-status-${deploymentId}`}>
        —
      </span>
    );
  }

  const config: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    running: {
      icon: null,
      label: 'Running',
      className: 'bg-transparent text-green-600 border-green-300',
    },
    queued: {
      icon: <Clock className="h-3.5 w-3.5" />,
      label: 'Queued',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    locked: {
      icon: <Lock className="h-3.5 w-3.5" />,
      label: 'Locked',
      className: 'bg-gray-50 text-gray-600 border-gray-200',
    },
    success: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      label: 'Success',
      className: 'bg-green-50 text-green-700 border-green-200',
    },
    failed: {
      icon: <XCircle className="h-3.5 w-3.5" />,
      label: 'Failed',
      className: 'bg-red-50 text-red-700 border-red-200',
    },
    warning: {
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      label: 'Tests Failed',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
  };

  const { icon, label, className } = config[status] || config.failed;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-medium border',
        className
      )}
      data-testid={`run-status-${deploymentId}`}
    >
      {icon}
      {label}
    </div>
  );
}

function EmptyState({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-lg border"
      data-testid="empty-state"
    >
      <div className="mb-4">
        <FlowIcon className="h-16 w-16 rounded-lg" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No pipelines yet</h3>
      <p className="text-[15px] text-gray-500 text-center max-w-sm mb-6">
        Pipelines orchestrate your data syncs and transformations. Create your first pipeline to get
        started.
      </p>
      {canCreate && (
        <Button onClick={onCreate} data-testid="create-pipeline-empty-btn">
          <Plus className="h-4 w-4 mr-2" />
          Create Pipeline
        </Button>
      )}
    </div>
  );
}

function PipelineListSkeleton() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-6 pb-4">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6">
        <div className="h-full overflow-y-auto">
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-32 ml-auto" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-9 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
