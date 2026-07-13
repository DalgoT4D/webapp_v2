// components/transform/ui-transform/UITransformTab.tsx
'use client';

import Link from 'next/link';
import { DBTRepositoryCard } from '../DBTRepositoryCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import CanvasPreview from './canvas/CanvasPreview';

interface UITransformTabProps {
  onGitConnected: () => void;
  gitConnected: boolean;
}

export function UITransformTab({ onGitConnected, gitConnected }: UITransformTabProps) {
  const { hasPermission } = useRbac();
  // Read-only roles (e.g. analyst) get a "View workflow" entry point; the canvas
  // itself is already node-gated and Publish is disabled for them.
  const canEditWorkflow = hasPermission(PERMISSIONS.CAN_EDIT_DBT_WORKSPACE);

  return (
    <div className="space-y-6" data-testid="ui-transform-tab">
      {/* DBT Repository Connection Section */}
      <DBTRepositoryCard onConnectGit={onGitConnected} />

      {/* Workflow Canvas Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Workflow</CardTitle>
          <Link href="/transform/canvas">
            <Button variant="primary" data-testid="edit-workflow-btn">
              {canEditWorkflow ? 'EDIT WORKFLOW' : 'VIEW WORKFLOW'}
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div
            className="h-[400px] rounded-md overflow-hidden border"
            data-testid="canvas-preview-container"
          >
            <CanvasPreview />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
