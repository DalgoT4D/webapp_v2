// components/transform/DBTTaskList.tsx
'use client';

import { useState } from 'react';
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
import { Loader2, MoreHorizontal, Play, Settings, Trash2, Lock, Clock } from 'lucide-react';
import {
  usePrefectTasks,
  runPrefectDeployment,
  deletePrefectTask,
} from '@/hooks/api/usePrefectTasks';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { toast } from 'sonner';
import type { TransformTask } from '@/types/transform';

interface DBTTaskListProps {
  isAnyTaskLocked: boolean;
  fetchDbtTasks: () => void;
  fetchLogs: (flowRunId: string) => void;
  setFlowRunId: (id: string) => void;
  setDbtRunLogs: (logs: string[]) => void;
  setExpandLogs: (expand: boolean) => void;
}

export function DBTTaskList({
  isAnyTaskLocked,
  fetchDbtTasks,
  fetchLogs,
  setFlowRunId,
  setDbtRunLogs,
  setExpandLogs,
}: DBTTaskListProps) {
  const { data: tasks, mutate } = usePrefectTasks();
  const { hasPermission } = useUserPermissions();
  const [runningTask, setRunningTask] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canRunTask = hasPermission('can_run_orgtask');
  const canDeleteTask = hasPermission('can_delete_orgtask');
  const canEditTask = hasPermission('can_edit_orgtask');

  const handleRunTask = async (task: TransformTask) => {
    if (!task.deploymentId) {
      toast.error('No deployment found for this task');
      return;
    }

    setRunningTask(task.uuid);
    setDbtRunLogs([]);
    setExpandLogs(true);

    try {
      const response = await runPrefectDeployment(task.deploymentId);

      if (!response.flow_run_id) {
        toast.error('Something went wrong - no flow run ID returned');
        setRunningTask(null);
        return;
      }

      // Set flow run ID and start fetching logs
      setFlowRunId(response.flow_run_id);
      fetchLogs(response.flow_run_id);

      toast.success(`${task.label} started successfully`);
      mutate(); // Refresh task list to show lock status
    } catch (error: any) {
      toast.error(error.message || `Failed to run ${task.label}`);
    } finally {
      setRunningTask(null);
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteTaskId) return;

    setDeleteLoading(true);
    try {
      await deletePrefectTask(deleteTaskId);
      toast.success('Task deleted successfully');
      mutate(); // Refresh task list
      setDeleteTaskId(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete task');
    } finally {
      setDeleteLoading(false);
    }
  };

  const isTaskRunning = (task: TransformTask) => {
    return runningTask === task.uuid || (task.lock?.status && task.lock.status !== 'complete');
  };

  const formatLastRunTime = (lastRun: TransformTask['lastRun']) => {
    if (!lastRun) return 'Never';
    const date = new Date(lastRun.startTime);
    return date.toLocaleString();
  };

  return (
    <>
      <Card data-testid="dbt-task-list">
        <CardHeader>
          <CardTitle>DBT Actions</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Execute and manage your DBT transformation tasks
          </p>
        </CardHeader>
        <CardContent>
          {!tasks || tasks.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-muted-foreground">No DBT tasks configured</p>
              <p className="text-sm text-muted-foreground">
                Click "New Task" to create your first transformation task
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="text-base font-medium">Label</TableHead>
                    <TableHead className="text-base font-medium">Command</TableHead>
                    <TableHead className="text-base font-medium text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow
                      key={task.uuid}
                      data-testid={`task-${task.uuid}`}
                      className="hover:bg-gray-50/50"
                    >
                      <TableCell className="py-4 font-medium text-lg text-gray-900">
                        {task.label}
                      </TableCell>
                      <TableCell className="py-4 text-base text-gray-700">{task.command}</TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center justify-end gap-3">
                          {/* Show "Triggered by" when task is locked */}
                          {task.lock && isAnyTaskLocked && (
                            <div className="flex items-center gap-2">
                              {task.lock.status === 'running' ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : task.lock.status === 'locked' ||
                                task.lock.status === 'complete' ? (
                                <Lock className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Clock className="h-4 w-4 text-muted-foreground" />
                              )}
                              <div className="text-left">
                                <p className="text-sm font-semibold text-gray-900">
                                  Triggered by: {task.lock.lockedBy?.split('@')[0]}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {new Date(task.lock.lockedAt).toLocaleString()}
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
                            className="text-white hover:opacity-90 shadow-xs"
                            style={{ backgroundColor: '#06887b' }}
                          >
                            {isTaskRunning(task) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-1" />
                                Execute
                              </>
                            )}
                          </Button>

                          {/* Show menu on ALL tasks, but only show delete for client tasks */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!!runningTask || isAnyTaskLocked}
                                data-testid={`task-menu-${task.uuid}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={true}
                                data-testid={`edit-task-${task.uuid}`}
                              >
                                <Settings className="h-4 w-4 mr-2" />
                                Configure
                              </DropdownMenuItem>
                              {/* Only show delete for client-generated tasks */}
                              {task.generated_by === 'client' && (
                                <DropdownMenuItem
                                  disabled={!canDeleteTask}
                                  onClick={() => setDeleteTaskId(task.uuid)}
                                  className="text-destructive"
                                  data-testid={`delete-task-${task.uuid}`}
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
