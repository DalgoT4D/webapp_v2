'use client';

import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  Loader2,
  Plus,
  Redo,
  Target,
  Type,
  Undo,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardDescriptionEditor } from './DashboardDescriptionEditor';
import type { BuilderHeaderProps } from './DashboardBuilderHeader';

export function BuilderHeaderCompact({
  title,
  isEditingTitle,
  onTitleChange,
  onTitleEditStart,
  onTitleCommit,
  description,
  onDescriptionChange,
  onDescriptionSave,
  onBack,
  onPreview,
  isNavigating,
  onAddChartCompact,
  onAddKpi,
  onAddText,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  saveStatus,
}: BuilderHeaderProps) {
  return (
    <div className="lg:hidden">
      {/* Mobile Top Row - Title and Essential Actions */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              aria-label="Back"
              // testid read by the walkthrough's exit guard: the builder is otherwise
              // fully usable mid-walkthrough, and leaving it is the one thing that asks
              // first (see DASHBOARD_BUILDER_EXITS in insight-walkthrough-coachmark.tsx).
              data-testid="dashboard-back-btn"
              className="p-1 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}

          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            {isEditingTitle ? (
              <Input
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Dashboard title..."
                className="text-sm font-semibold h-8"
                data-testid="dashboard-title-input-mobile"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onTitleCommit();
                  }
                }}
                onBlur={onTitleCommit}
              />
            ) : (
              <div
                className="cursor-pointer min-w-0"
                onClick={onTitleEditStart}
                data-testid="dashboard-title-display-mobile"
              >
                <h1 className="text-sm font-semibold truncate dashboard-header-title">{title}</h1>
              </div>
            )}

            <DashboardDescriptionEditor
              value={description}
              onChange={onDescriptionChange}
              onSave={onDescriptionSave}
              testId="dashboard-description-mobile"
            />
          </div>
        </div>

        {/* Mobile Quick Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onPreview && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onPreview}
              className="p-1.5"
              disabled={isNavigating}
              data-testid="view-dashboard-mobile-btn"
              aria-label={isNavigating ? 'Saving and opening dashboard view' : 'View dashboard'}
              title={isNavigating ? 'Saving and opening dashboard view' : 'View dashboard'}
            >
              {isNavigating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Bottom Row - Component Actions */}
      <div className="px-4 pb-2 flex items-center gap-2 overflow-x-auto mobile-action-row">
        <Button
          onClick={onAddChartCompact}
          size="sm"
          className="flex-shrink-0 h-8 text-xs"
          data-testid="dashboard-builder-add-chart-btn-mobile"
        >
          <Plus className="w-3 h-3 mr-1" />
          Chart
        </Button>
        <Button
          onClick={onAddKpi}
          size="sm"
          variant="outline"
          className="flex-shrink-0 h-8 text-xs"
          data-testid="dashboard-builder-add-kpi-btn-mobile"
        >
          <Target className="w-3 h-3 mr-1" />
          KPI
        </Button>
        <Button
          onClick={onAddText}
          size="sm"
          variant="outline"
          className="flex-shrink-0 h-8 text-xs"
          data-testid="dashboard-builder-add-text-btn-mobile"
        >
          <Type className="w-3 h-3 mr-1" />
          Text
        </Button>
        <div className="flex gap-1 ml-auto flex-shrink-0">
          <Button
            onClick={onUndo}
            disabled={!canUndo}
            size="sm"
            variant="ghost"
            className="p-1 h-8"
            data-testid="dashboard-builder-undo-btn-mobile"
          >
            <Undo className="w-3 h-3" />
          </Button>
          <Button
            onClick={onRedo}
            disabled={!canRedo}
            size="sm"
            variant="ghost"
            className="p-1 h-8"
            data-testid="dashboard-builder-redo-btn-mobile"
          >
            <Redo className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Mobile Status Bar */}
      {saveStatus !== 'idle' && (
        <div
          className="px-4 pb-2 flex items-center justify-between text-xs"
          data-testid="dashboard-save-status-mobile"
        >
          {saveStatus === 'saving' && (
            <div
              className="flex items-center gap-1 text-gray-500"
              data-testid="dashboard-save-status-saving-mobile"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
          {saveStatus === 'saved' && (
            <div
              className="flex items-center gap-1 text-green-600"
              data-testid="dashboard-save-status-saved-mobile"
            >
              <Check className="w-3 h-3" />
              <span>Saved</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div
              className="flex items-center gap-1 text-red-600"
              data-testid="dashboard-save-status-error-mobile"
            >
              <AlertCircle className="w-3 h-3" />
              <span>Error</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
