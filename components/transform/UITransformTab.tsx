// components/transform/UITransformTab.tsx
'use client';

import Link from 'next/link';
import { DBTRepositoryCard } from './DBTRepositoryCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Construction } from 'lucide-react';

interface UITransformTabProps {
  onGitConnected: () => void;
  gitConnected: boolean;
}

export function UITransformTab({ onGitConnected, gitConnected }: UITransformTabProps) {
  return (
    <div className="space-y-6" data-testid="ui-transform-tab">
      {/* GitHub Repository Connection Section */}
      <DBTRepositoryCard onConnectGit={onGitConnected} />

      {/* Workflow Canvas Section - Phase 2 Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Visual Workflow Designer</CardTitle>
          <CardDescription>
            Build data transformation workflows using a visual canvas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 space-y-6">
            <div className="rounded-full bg-muted p-6">
              <Construction className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">Coming Soon</p>
              <p className="text-sm text-muted-foreground max-w-md">
                The visual workflow canvas will be available in Phase 2, allowing you to design
                transformation pipelines with drag-and-drop simplicity.
              </p>
            </div>
            <Link href="/transform/canvas">
              <Button variant="outline" size="lg" data-testid="edit-workflow-btn">
                EDIT WORKFLOW
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
