// components/transform/canvas/CanvasHeader.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Play, Upload, GitBranch, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTransformStore } from '@/stores/transformStore';
import { useUserPermissions } from '@/hooks/api/usePermissions';
import { CanvasNodeTypeEnum } from '@/types/transform';

interface CanvasHeaderProps {
  /** Whether canvas is locked by another user */
  isLocked: boolean;
  /** Whether a workflow is currently running */
  isWorkflowRunning?: boolean;
  /** Git repo URL for link */
  gitRepoUrl?: string;
  /** Is preview mode (hides action buttons) */
  isPreviewMode?: boolean;
}

export default function CanvasHeader({
  isLocked,
  isWorkflowRunning = false,
  gitRepoUrl,
  isPreviewMode = false,
}: CanvasHeaderProps) {
  const router = useRouter();
  const [runMenuOpen, setRunMenuOpen] = useState(false);

  const selectedNode = useTransformStore((s) => s.selectedNode);
  const dispatchCanvasAction = useTransformStore((s) => s.dispatchCanvasAction);
  const openPublishModal = useTransformStore((s) => s.openPublishModal);

  const patRequired = useTransformStore((s) => s.patRequired);
  const { hasPermission } = useUserPermissions();
  const canRun = hasPermission('can_run_pipeline');

  // Run: disabled only when locked by other, workflow running, or no permission
  const runDisabled = !canRun || isLocked || isWorkflowRunning;
  // Publish: disabled when locked by other, workflow running, or PAT not configured
  const publishDisabled = isLocked || isWorkflowRunning || patRequired;

  // Can only run to/from node if a source or model is selected (not operation)
  const canRunToFromNode =
    selectedNode &&
    selectedNode.data &&
    [CanvasNodeTypeEnum.Source, CanvasNodeTypeEnum.Model].includes(selectedNode.data.node_type);

  const handleRun = (type: 'run' | 'run-to-node' | 'run-from-node') => {
    const nodeName = selectedNode?.data?.dbtmodel?.name;

    let data = null;
    if (type === 'run-to-node' && nodeName) {
      // Run from start to this node (+nodeName means include predecessors)
      data = { options: { select: `+${nodeName}` } };
    } else if (type === 'run-from-node' && nodeName) {
      // Run from this node to end (nodeName+ means include descendants)
      data = { options: { select: `${nodeName}+` } };
    }

    dispatchCanvasAction({ type: 'run-workflow', data });
    setRunMenuOpen(false);
  };

  const handlePublish = () => {
    openPublishModal();
  };

  // In preview mode, show minimal header
  if (isPreviewMode) {
    return (
      <div className="flex items-center justify-between h-full px-5 bg-white border-b">
        <span className="text-lg font-semibold text-gray-700">Workflow Preview</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between h-full px-5 bg-white border-b">
      {/* Left side - Back button + Git link */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/transform')}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
          data-testid="back-to-transform-btn"
          aria-label="Back to Transform"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        {gitRepoUrl && (
          <>
            <span className="text-gray-300">|</span>
            <a
              href={gitRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-teal-600 transition-colors"
              data-testid="git-repo-link"
            >
              <GitBranch className="w-4 h-4" />
              <span className="hidden sm:inline">Repository</span>
            </a>
          </>
        )}
      </div>

      {/* Center - Title */}
      <span className="text-lg font-semibold text-gray-700">Workflow</span>

      {/* Right side - Actions */}
      <div className="flex gap-2">
        {/* Run Button with Dropdown */}
        <DropdownMenu open={runMenuOpen} onOpenChange={setRunMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="sm"
              disabled={runDisabled}
              className="text-white hover:opacity-90 shadow-xs"
              style={{ backgroundColor: 'var(--primary)' }}
              data-testid="run-button"
            >
              <Play className="w-4 h-4 mr-1" />
              Run
              <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleRun('run')} data-testid="run-workflow-option">
              Run workflow
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleRun('run-to-node')}
              disabled={!canRunToFromNode}
              data-testid="run-to-node-option"
            >
              Run to node
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleRun('run-from-node')}
              disabled={!canRunToFromNode}
              data-testid="run-from-node-option"
            >
              Run from node
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Publish Button */}
        <Button
          variant="default"
          size="sm"
          disabled={publishDisabled}
          onClick={handlePublish}
          className="text-white hover:opacity-90 shadow-xs"
          style={{ backgroundColor: 'var(--primary)' }}
          data-testid="publish-button"
        >
          <Upload className="w-4 h-4 mr-1" />
          Publish
        </Button>
      </div>
    </div>
  );
}
