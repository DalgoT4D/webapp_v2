// components/transform/dbt-transform/DBTTransformTab.tsx
'use client';

import { useState } from 'react';
import { DBTRepositoryCard } from '../DBTRepositoryCard';
import { DBTTaskList } from './DBTTaskList';
import { CreateTaskDialog } from './CreateTaskDialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
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
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>

        {/* DBT Actions */}
        <DBTTaskList isAnyTaskLocked={isAnyTaskLocked} />
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => mutateTasks()}
      />
    </div>
  );
}
