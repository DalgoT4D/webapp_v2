// components/transform/ui-transform/UITransformTab.tsx
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { DBTRepositoryCard } from '../DBTRepositoryCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CanvasPreview from './canvas/CanvasPreview';
import { useCanvasGraph } from '@/hooks/api/useCanvasGraph';

interface UITransformTabProps {
  onGitConnected: () => void;
  gitConnected: boolean;
}

export function UITransformTab({ onGitConnected, gitConnected }: UITransformTabProps) {
  const { nodes } = useCanvasGraph({ skipInitialFetch: false, autoSync: false });

  const hasUnpublishedChanges = useMemo(() => {
    return nodes?.some((node) => node.isPublished === false) ?? false;
  }, [nodes]);

  return (
    <div className="space-y-6" data-testid="ui-transform-tab">
      {/* DBT Repository Connection Section */}
      <DBTRepositoryCard onConnectGit={onGitConnected} />

      {/* Workflow Canvas Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>Workflow</CardTitle>
            {hasUnpublishedChanges && (
              <span
                className="flex items-center gap-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-400 rounded-md px-2.5 py-1"
                data-testid="unpublished-changes-indicator"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Unpublished changes
              </span>
            )}
          </div>
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
