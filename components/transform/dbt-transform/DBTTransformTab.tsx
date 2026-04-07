// components/transform/dbt-transform/DBTTransformTab.tsx
'use client';

import { useState } from 'react';
import { DBTRepositoryCard } from '../DBTRepositoryCard';
import { DBTTaskList } from './DBTTaskList';
import { CreateTaskDialog } from './CreateTaskDialog';
import { usePrefectTasks } from '@/hooks/api/usePrefectTasks';
import { useUserPermissions } from '@/hooks/api/usePermissions';

interface DBTTransformTabProps {
  onConnectGit: () => void;
}

export function DBTTransformTab({ onConnectGit }: DBTTransformTabProps) {
  const { data: tasks, mutate: mutateTasks } = usePrefectTasks();
  const { hasPermission } = useUserPermissions();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Check if any task is locked
  const isAnyTaskLocked = tasks?.some((task) => task.lock) ?? false;

  // Check permissions
  const canCreateTask = hasPermission('can_create_orgtask');

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
