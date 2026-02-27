'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Lock,
  Loader2,
  MoreHorizontal,
  History,
  RefreshCw,
  Pencil,
  Trash2,
  Clock,
} from 'lucide-react';
import { TaskAltIcon, WarningAmberIcon, LoopIcon } from '@/assets/icons/status-icons';
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
import type { Pipeline } from '@/types/pipeline';
import {
  LockStatus,
  FlowRunStatus,
  FlowRunStateName,
  PipelineRunDisplayStatus,
} from '@/constants/pipeline';
import { cronToString, lastRunTime, localTimezone, getFlowRunStartedBy, trimEmail } from './utils';
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
        mutate(); // this cause the polling and based on lock condition the refreshinterval keeps on polling the data.
        return {};
      } catch (error: any) {
        toastError.api(error, 'Failed to run pipeline');
        return { error: 'ERROR' };
      }
    },
    [mutate] //mutate is safe to pass in the dependency- reference does not change on each rerender.
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
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between mb-6 p-6 pb-0">
          <div>
            <h1 className="text-3xl font-bold">Pipelines</h1>
            <p className="text-muted-foreground mt-1">
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
      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 mt-6">
        <div className="h-full overflow-y-auto">
          {pipelines.length === 0 ? (
            <EmptyState canCreate={canCreatePipeline} onCreate={handleCreate} />
          ) : (
            <div className="bg-white rounded-lg border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="text-base font-medium">Pipeline</TableHead>
                    <TableHead className="text-base font-medium">Schedule</TableHead>
                    <TableHead className="text-base font-medium">Status</TableHead>
                    <TableHead className="text-base font-medium">Last Run</TableHead>
                    <TableHead className="text-base font-medium">Result</TableHead>
                    <TableHead className="text-base font-medium text-center">Actions</TableHead>
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
  const isRunning = !!lock || tempSyncState;
  const isDisabled = isLocked || tempSyncState;

  const handleRunClick = async () => {
    setTempSyncState(true);
    const result = await onRun(deploymentId);
    if (result && result.error) {
      setTempSyncState(false);
    }
  };

  // Determine run status
  // locked (optimistic + backend) → queued → running → success/failed
  const getRunStatus = () => {
    if (lock?.status === LockStatus.RUNNING) return PipelineRunDisplayStatus.RUNNING;
    if (lock?.status === LockStatus.QUEUED) return PipelineRunDisplayStatus.QUEUED;
    if (lock?.status === LockStatus.LOCKED || lock?.status === LockStatus.COMPLETE)
      return PipelineRunDisplayStatus.LOCKED;
    if (tempSyncState) return PipelineRunDisplayStatus.LOCKED;
    if (!lastRun) return null;
    if (lastRun.state_name === FlowRunStateName.DBT_TEST_FAILED)
      return PipelineRunDisplayStatus.WARNING;
    if (lastRun.status === FlowRunStatus.COMPLETED) return PipelineRunDisplayStatus.SUCCESS;
    return PipelineRunDisplayStatus.FAILED;
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
            className="font-medium text-base text-gray-900"
            data-testid={`pipeline-name-${deploymentId}`}
          >
            {name}
          </span>
        </div>
      </TableCell>

      {/* Schedule */}
      <TableCell className="py-4">
        <div className="text-base text-gray-700">
          <span>{cron ? cronToString(cron) : 'Manual'}</span>
        </div>
        {cron && <span className="text-sm text-gray-500">{localTimezone()}</span>}
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
                'text-base',
                lastRunInfo.isRunning ? 'text-amber-600 font-medium' : 'text-gray-700'
              )}
            >
              {lastRunInfo.time}
            </span>
            {lastRunInfo.by && (
              <div className="text-sm text-gray-500 mt-0.5">
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
          <span className="text-base text-gray-400">—</span>
        )}
      </TableCell>

      {/* Last Run Status */}
      <TableCell className="py-4">
        <StatusBadge status={runStatus} deploymentId={deploymentId} />
      </TableCell>

      {/* Actions */}
      <TableCell className="py-4">
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onViewHistory(pipeline)}
            disabled={!canViewPipeline}
            className="h-8 w-8 p-0 hover:bg-gray-100"
            data-testid={`history-btn-${deploymentId}`}
            aria-label="History"
          >
            <History className="w-4 h-4 text-gray-600" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRunClick}
            disabled={isDisabled || !canRunPipeline}
            data-testid={`run-btn-${deploymentId}`}
            className={cn('h-8 w-8 p-0 hover:bg-gray-100', isRunning && 'cursor-not-allowed')}
            aria-label="Run"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 text-gray-600 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 text-gray-600" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={isDisabled}
                className="h-8 w-8 p-0 hover:bg-gray-100"
                data-testid={`more-btn-${deploymentId}`}
              >
                <MoreHorizontal className="w-4 h-4 text-gray-600" />
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

function StatusBadge({
  status,
  deploymentId,
}: {
  status: PipelineRunDisplayStatus | null;
  deploymentId: string;
}) {
  if (!status) {
    return (
      <span className="text-base text-gray-400" data-testid={`run-status-${deploymentId}`}>
        —
      </span>
    );
  }

  const config: Record<
    PipelineRunDisplayStatus,
    { icon: React.ReactNode; label: string; className: string }
  > = {
    [PipelineRunDisplayStatus.RUNNING]: {
      icon: <LoopIcon className="h-3.5 w-3.5" />,
      label: 'Running',
      className: 'bg-transparent text-green-600 border-green-300',
    },
    [PipelineRunDisplayStatus.QUEUED]: {
      icon: <Clock className="h-3.5 w-3.5" />,
      label: 'Queued',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    [PipelineRunDisplayStatus.LOCKED]: {
      icon: <Lock className="h-3.5 w-3.5" />,
      label: 'Locked',
      className: 'bg-gray-50 text-gray-600 border-gray-200',
    },
    [PipelineRunDisplayStatus.SUCCESS]: {
      icon: <TaskAltIcon className="h-3.5 w-3.5" />,
      label: 'Success',
      className: 'bg-green-50 text-green-700 border-green-200',
    },
    [PipelineRunDisplayStatus.FAILED]: {
      icon: <WarningAmberIcon className="h-3.5 w-3.5" />,
      label: 'Failed',
      className: 'bg-red-50 text-red-700 border-red-200',
    },
    [PipelineRunDisplayStatus.WARNING]: {
      icon: <WarningAmberIcon className="h-3.5 w-3.5" />,
      label: 'DBT Test Failed',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
  };

  const { icon, label, className } = config[status] || config[PipelineRunDisplayStatus.FAILED];

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-medium border min-w-[110px]',
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
      <p className="text-base text-gray-500 text-center max-w-sm mb-6">
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
