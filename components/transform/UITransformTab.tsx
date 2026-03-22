// components/transform/UITransformTab.tsx
'use client';

import Link from 'next/link';
import { DBTRepositoryCard } from './DBTRepositoryCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CanvasPreview from './canvas/CanvasPreview';

interface UITransformTabProps {
  onGitConnected: () => void;
  gitConnected: boolean;
}

export function UITransformTab({ onGitConnected, gitConnected }: UITransformTabProps) {
  return (
    <div className="space-y-6" data-testid="ui-transform-tab">
      {/* GitHub Repository Connection Section */}
      <DBTRepositoryCard onConnectGit={onGitConnected} />

      {/* Workflow Canvas Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Workflow</CardTitle>
          <Link href="/transform/canvas">
            <Button
              variant="ghost"
              className="text-white hover:opacity-90 shadow-xs"
              style={{ backgroundColor: 'var(--primary)' }}
              data-testid="edit-workflow-btn"
            >
              Edit Workflow
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
