// components/transform/dbt-transform/DBTTransformTab.tsx
'use client';

import { useState } from 'react';
import { DBTRepositoryCard } from '../DBTRepositoryCard';
import { DBTTaskList } from './DBTTaskList';
import { CreateTaskDialog } from './CreateTaskDialog';
import { usePrefectTasks } from '@/hooks/api/usePrefectTasks';
import { PERMISSIONS, useRbac } from '@/lib/rbac';

interface DBTTransformTabProps {
  onConnectGit: () => void;
}

export function DBTTransformTab({ onConnectGit }: DBTTransformTabProps) {
  const { data: tasks, mutate: mutateTasks } = usePrefectTasks();
  const { hasPermission } = useRbac();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Check if any task is locked
  const isAnyTaskLocked = tasks?.some((task) => task.lock) ?? false;

  // Check permissions
  const canCreateTask = hasPermission(PERMISSIONS.CAN_CREATE_ORGTASK);

  return (
    <div className="space-y-6" data-testid="dbt-transform-tab">
      {/* GitHub Repository Connection Section */}
      <DBTRepositoryCard onConnectGit={onConnectGit} />

      {/* DBT Actions */}
      <DBTTaskList
        isAnyTaskLocked={isAnyTaskLocked}
        onNewTask={() => setShowCreateDialog(true)}
        canCreateTask={canCreateTask}
      />

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => mutateTasks()}
      />
    </div>
  );
}
