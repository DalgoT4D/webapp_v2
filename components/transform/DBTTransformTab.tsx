// components/transform/DBTTransformTab.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { DBTRepositoryCard } from './DBTRepositoryCard';
import { DBTTaskList } from './DBTTaskList';
import { LogCard } from './LogCard';
import { CreateTaskDialog } from './CreateTaskDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { usePrefectTasks } from '@/hooks/api/usePrefectTasks';
import { useTaskStatus } from '@/hooks/api/usePrefectTasks';
import { useUserPermissions } from '@/hooks/api/usePermissions';

interface DBTTransformTabProps {
  gitConnected: boolean;
  onConnectGit: () => void;
}

export function DBTTransformTab({ gitConnected, onConnectGit }: DBTTransformTabProps) {
  const { data: tasks, mutate: mutateTasks } = usePrefectTasks();
  const { hasPermission } = useUserPermissions();
  const [flowRunId, setFlowRunId] = useState('');
  const [maxLogs, setMaxLogs] = useState<number>(100);
  const [expandLogs, setExpandLogs] = useState<boolean>(false);
  const [dbtSetupLogs, setDbtSetupLogs] = useState<string[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const dbtSetupLogsRef = useRef<string[]>([]);

  // Check if any task is locked
  const isAnyTaskLocked = tasks?.some((task) => task.lock) ?? false;

  // Check permissions
  const canCreateTask = hasPermission('can_create_orgtask');

  // Poll for task logs
  const { data: taskData } = useTaskStatus(flowRunId || null);

  useEffect(() => {
    dbtSetupLogsRef.current = dbtSetupLogs;
  }, [dbtSetupLogs]);

  useEffect(() => {
    if (taskData?.progress) {
      const logs = taskData.progress.map((p) => `[${p.status}] ${p.message}`);
      setDbtSetupLogs(logs);
    }
  }, [taskData]);

  const fetchMoreLogs = () => {
    setMaxLogs((prev) => prev + 100);
  };

  const handleFetchLogs = (flow_run_id: string) => {
    setFlowRunId(flow_run_id);
    setExpandLogs(true);
  };

  return (
    <div className="space-y-6" data-testid="dbt-transform-tab">
      {/* GitHub Repository Connection Section */}
      <DBTRepositoryCard onConnectGit={onConnectGit} />

      {/* Task Management Section */}
      <div className="space-y-4">
        {/* Create Task Button */}
        <div className="flex justify-end">
          <Button
            onClick={() => setShowCreateDialog(true)}
            size="sm"
            variant="ghost"
            disabled={!canCreateTask}
            data-testid="new-task-btn"
            className="text-white hover:opacity-90 shadow-xs"
            style={{ backgroundColor: '#06887b' }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>

        {/* DBT Actions */}
        <DBTTaskList
          isAnyTaskLocked={isAnyTaskLocked}
          fetchDbtTasks={() => mutateTasks()}
          fetchLogs={handleFetchLogs}
          setFlowRunId={setFlowRunId}
          setDbtRunLogs={setDbtSetupLogs}
          setExpandLogs={setExpandLogs}
        />
      </div>

      {/* Log Card */}
      {dbtSetupLogs.length > 0 && (
        <LogCard
          logs={dbtSetupLogs}
          expand={expandLogs}
          setExpand={setExpandLogs}
          fetchMore={dbtSetupLogs.length >= maxLogs}
          fetchMoreLogs={fetchMoreLogs}
        />
      )}

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => mutateTasks()}
      />
    </div>
  );
}
