// components/transform/dbt-transform/DBTTaskList.tsx
'use client';

import { Fragment, useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, MoreHorizontal, Play, Plus, Settings, Trash2, Lock, Clock } from 'lucide-react';
import {
  usePrefectTasks,
  runPrefectDeployment,
  runPrefectTask,
  fetchFlowRunLogs,
  fetchFlowRunStatus,
  deletePrefectTask,
} from '@/hooks/api/usePrefectTasks';
import { LogCard } from '@/components/pipeline/log-card';
import { PipelineRunDisplayStatus, LockStatus } from '@/constants/pipeline';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { toastSuccess, toastError } from '@/lib/toast';
import {
  TASK_DBTRUN,
  TASK_DBTTEST,
  TASK_DOCSGENERATE,
  FLOW_RUN_LOGS_OFFSET_LIMIT,
} from '@/constants/dbt-tasks';
import type { TransformTask } from '@/types/transform';
import { timeAgo } from '../utils';

interface DBTTaskListProps {
  isAnyTaskLocked: boolean;
  onNewTask: () => void;
  canCreateTask: boolean;
}

export function DBTTaskList({ isAnyTaskLocked, onNewTask, canCreateTask }: DBTTaskListProps) {
  const { data: tasks, mutate } = usePrefectTasks();
  const { hasPermission } = useUserPermissions();
  const [runningTask, setRunningTask] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Log state — scoped to the task that was last executed
  const [logTaskUuid, setLogTaskUuid] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logStatus, setLogStatus] = useState<PipelineRunDisplayStatus | undefined>(undefined);
  const [logsLoading, setLogsLoading] = useState(false);
  const [maxLogs, setMaxLogs] = useState(FLOW_RUN_LOGS_OFFSET_LIMIT);
  const [flowRunId, setFlowRunId] = useState('');
  const logsRef = useRef<string[]>([]);

  const canRunTask = hasPermission('can_run_orgtask');
  const canDeleteTask = hasPermission('can_delete_orgtask');

  // Keep ref in sync with state for closure-safe access
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // Reset log state for a new task execution
  const resetLogs = useCallback((taskUuid: string) => {
    setLogTaskUuid(taskUuid);
    setLogs([]);
    logsRef.current = [];
    setLogStatus(undefined);
    setLogsLoading(true);
    setMaxLogs(FLOW_RUN_LOGS_OFFSET_LIMIT);
    setFlowRunId('');
  }, []);

  // Fetch flow run logs with pagination
  const fetchLogs = useCallback(
    async (runId: string, maxLimit: number = FLOW_RUN_LOGS_OFFSET_LIMIT) => {
      if (!runId) return;

      const currCount = logsRef.current.length;
      if (currCount >= maxLimit) return;

      try {
        const response = await fetchFlowRunLogs(runId, currCount, maxLimit - currCount);

        if (response?.logs?.logs?.length > 0) {
          const newLogStrings = response.logs.logs.map((logObj) => logObj.message);
          const allLogs = logsRef.current.concat(newLogStrings);
          setLogs(allLogs);
          logsRef.current = allLogs;
        }
      } catch {
        // Silently fail log fetching — non-critical
      }
    },
    []
  );

  const fetchMoreLogs = useCallback(() => {
    const newMax = maxLogs + FLOW_RUN_LOGS_OFFSET_LIMIT;
    setMaxLogs(newMax);
    fetchLogs(flowRunId, newMax);
  }, [maxLogs, flowRunId, fetchLogs]);

  const handleRunTask = async (task: TransformTask) => {
    setRunningTask(task.uuid);
    resetLogs(task.uuid);

    try {
      // Path A: Deployment-based execution (dbt-run or any task with deploymentId)
      if (task.slug === TASK_DBTRUN || task.deploymentId) {
        await handleDeploymentRun(task);
      }
      // Path B: Direct execution (dbt-test, dbt-deps, dbt-seed, etc.)
      else {
        await handleDirectRun(task);
      }
    } catch (error: unknown) {
      toastError.api(error, `Failed to run ${task.label}`);
      setLogStatus(PipelineRunDisplayStatus.FAILED);
    } finally {
      setRunningTask(null);
      setLogsLoading(false);
      mutate(); // Refresh task list
    }
  };

  const handleDeploymentRun = async (task: TransformTask) => {
    if (!task.deploymentId) {
      toastError.api('No deployment found for this task');
      return;
    }

    const response = await runPrefectDeployment(task.deploymentId);

    if (!response.flow_run_id) {
      toastError.api('Something went wrong - no flow run ID returned');
      return;
    }

    setFlowRunId(response.flow_run_id);
    mutate(); // Refresh task list to show lock status

    // Poll flow run status every 5s, fetching logs each iteration (matching v1)
    const DEPLOYMENT_POLL_INTERVAL_MS = 5000;
    let status = await fetchFlowRunStatus(response.flow_run_id);

    while (!['COMPLETED', 'FAILED'].includes(status)) {
      await new Promise((resolve) => setTimeout(resolve, DEPLOYMENT_POLL_INTERVAL_MS));
      fetchLogs(response.flow_run_id);
      status = await fetchFlowRunStatus(response.flow_run_id);
    }

    // Final log fetch and status
    await fetchLogs(response.flow_run_id);
    setLogStatus(
      status === 'COMPLETED' ? PipelineRunDisplayStatus.SUCCESS : PipelineRunDisplayStatus.FAILED
    );
    mutate();
  };

  const handleDirectRun = async (task: TransformTask) => {
    const response = await runPrefectTask(task.uuid);

    const isSuccess = response?.status === 'success';
    if (isSuccess) {
      toastSuccess.generic(`${task.label} ran successfully`);
      setLogStatus(PipelineRunDisplayStatus.SUCCESS);
    } else {
      toastError.api(`${task.label} failed`);
      setLogStatus(PipelineRunDisplayStatus.FAILED);
    }

    // dbt-test special handling: if result contains a flow state object,
    // we need a separate API call to fetch the actual logs
    if (task.slug === TASK_DBTTEST && response?.result?.[0]) {
      const firstResult = response.result[0];
      if (typeof firstResult === 'object' && firstResult !== null && 'id' in firstResult) {
        const runId = (firstResult as { state_details?: { flow_run_id?: string } })?.state_details
          ?.flow_run_id;
        if (runId) {
          try {
            const logResponse = await fetchFlowRunLogs(runId);
            if (logResponse?.logs?.logs?.length > 0) {
              const logsArray = logResponse.logs.logs.map((logObj) => logObj.message);
              setLogs(logsArray);
              logsRef.current = logsArray;
            }
          } catch {
            // Log fetch failed, fall through to direct result display
          }
          return;
        }
      }
    }

    // Default: set the result array directly as logs
    if (response?.result) {
      const resultLogs = response.result.map((r) =>
        typeof r === 'string' ? r : JSON.stringify(r)
      );
      setLogs(resultLogs);
      logsRef.current = resultLogs;
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteTaskId) return;

    setDeleteLoading(true);
    try {
      await deletePrefectTask(deleteTaskId);
      toastSuccess.deleted('Task');
      mutate(); // Refresh task list
      setDeleteTaskId(null);
      // Clear logs if the deleted task was showing logs
      if (deleteTaskId === logTaskUuid) {
        setLogTaskUuid(null);
        setLogs([]);
      }
    } catch (error: unknown) {
      toastError.delete(error, 'task');
    } finally {
      setDeleteLoading(false);
    }
  };

  const isTaskRunning = (task: TransformTask) => {
    return runningTask === task.uuid || (task.lock?.status && task.lock.status !== 'complete');
  };

  const filteredTasks = tasks?.filter((task) => task.slug !== TASK_DOCSGENERATE) ?? [];

  return (
    <>
      <Card data-testid="dbt-task-list">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>DBT Actions</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Execute and manage your DBT transformation tasks
            </p>
          </div>
          <Button
            onClick={onNewTask}
            size="sm"
            variant="ghost"
            disabled={!canCreateTask}
            data-testid="new-task-btn"
            className="text-white hover:text-white hover:opacity-90 shadow-xs"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Plus className="h-4 w-4 mr-2" />
            NEW TASK
          </Button>
        </CardHeader>
        <CardContent>
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-muted-foreground">No DBT tasks configured</p>
              <p className="text-sm text-muted-foreground">
                Click &quot;NEW TASK&quot; to create your first transformation task
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="text-base font-medium pl-4">Label</TableHead>
                    <TableHead className="text-base font-medium pl-4">Command</TableHead>
                    <TableHead className="text-base font-medium text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <Fragment key={task.uuid}>
                      <TableRow data-testid={`task-${task.uuid}`} className="hover:bg-gray-50/50">
                        <TableCell className="py-4 pl-4 font-medium text-base text-gray-900">
                          {task.label}
                        </TableCell>
                        <TableCell className="py-4 pl-4 text-base text-gray-700">
                          {task.command}
                        </TableCell>
                        <TableCell className="py-4 pr-4">
                          <div className="flex items-center justify-end gap-3">
                            {/* Show "Triggered by" when task is locked */}
                            {task.lock && isAnyTaskLocked && (
                              <div className="flex items-center gap-2">
                                {task.lock.status === LockStatus.RUNNING ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : task.lock.status === LockStatus.LOCKED ||
                                  task.lock.status === LockStatus.COMPLETE ? (
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                )}
                                <div className="text-left">
                                  <p className="text-sm font-semibold text-gray-900">
                                    Triggered by: {task.lock.lockedBy?.split('@')[0]}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {timeAgo(task.lock.lockedAt)}
                                  </p>
                                </div>
                              </div>
                            )}

                            <Button
                              onClick={() => handleRunTask(task)}
                              disabled={!!runningTask || isAnyTaskLocked || !canRunTask}
                              size="sm"
                              variant="ghost"
                              data-testid={`run-task-${task.uuid}`}
                              className="text-white hover:text-white hover:opacity-90 shadow-xs min-w-[110px]"
                              style={{ backgroundColor: 'var(--primary)' }}
                            >
                              {isTaskRunning(task) ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  Running
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-1" />
                                  Execute
                                </>
                              )}
                            </Button>

                            {task.generated_by === 'client' ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    data-testid={`task-menu-${task.uuid}`}
                                    className={runningTask || isAnyTaskLocked ? 'invisible' : ''}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    disabled={!canDeleteTask}
                                    onClick={() => setDeleteTaskId(task.uuid)}
                                    className="text-destructive"
                                    data-testid={`delete-task-${task.uuid}`}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="pointer-events-none"
                                tabIndex={-1}
                              >
                                <Settings className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Inline logs beneath this task */}
                      {logTaskUuid === task.uuid && (logs.length > 0 || logsLoading) && (
                        <TableRow key={`${task.uuid}-logs`}>
                          <TableCell colSpan={3} className="p-0 border-t-0">
                            <LogCard
                              logs={logs}
                              isLoading={logsLoading}
                              hasMore={logs.length >= maxLogs}
                              onFetchMore={flowRunId ? fetchMoreLogs : undefined}
                              onClose={() => {
                                setLogTaskUuid(null);
                                setLogs([]);
                              }}
                              title={`Logs`}
                              status={logStatus}
                              showHeader={true}
                              className="m-3 mt-0"
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={(open) => !open && setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
