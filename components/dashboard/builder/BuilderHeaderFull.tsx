'use client';

import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  Loader2,
  Plus,
  Redo,
  Save,
  Target,
  Type,
  Undo,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardDescriptionEditor } from './DashboardDescriptionEditor';
import type { BuilderHeaderProps } from './DashboardBuilderHeader';

export function BuilderHeaderFull({
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
  onAddChart,
  onAddKpi,
  onAddText,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  saveStatus,
  saveError,
  onSave,
}: BuilderHeaderProps) {
  return (
    <div className="hidden lg:block px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button */}
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              // See the compact header's copy of this button above.
              data-testid="dashboard-back-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}

          <div className="h-6 w-px bg-gray-300" />

          {/* Title + Description editing — fixed width so the toolbar
                    doesn't shift as the description text grows/shrinks */}
          <div className="flex flex-col gap-0.5 w-64 flex-shrink-0">
            {isEditingTitle ? (
              <Input
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Dashboard title..."
                className="text-lg font-semibold h-8 w-full"
                data-testid="dashboard-title-input"
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
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-0.5"
                onClick={onTitleEditStart}
                data-testid="dashboard-title-display"
              >
                <h1 className="text-lg font-semibold dashboard-header-title truncate">{title}</h1>
              </div>
            )}

            <DashboardDescriptionEditor
              value={description}
              onChange={onDescriptionChange}
              onSave={onDescriptionSave}
              testId="dashboard-description"
            />
          </div>
        </div>

        <div className="h-6 w-px bg-gray-300 flex-shrink-0" />

        {/* Canvas actions — grouped right next to the title */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button onClick={onAddChart} size="sm" variant="outline" data-testid="add-chart-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Chart
          </Button>

          <Button onClick={onAddKpi} size="sm" variant="outline" data-testid="add-kpi-btn">
            <Target className="w-4 h-4 mr-2" />
            Add KPI
          </Button>

          <Button
            onClick={onAddText}
            size="sm"
            variant="outline"
            data-testid="dashboard-builder-add-text-btn"
          >
            <Type className="w-4 h-4 mr-2" />
            Add Text
          </Button>

          <div className="ml-2 flex gap-1">
            <Button
              onClick={onUndo}
              disabled={!canUndo}
              size="sm"
              variant="ghost"
              data-testid="dashboard-builder-undo-btn"
            >
              <Undo className="w-4 h-4" />
            </Button>

            <Button
              onClick={onRedo}
              disabled={!canRedo}
              size="sm"
              variant="ghost"
              data-testid="dashboard-builder-redo-btn"
            >
              <Redo className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Right zone: status + save/preview */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          {/* Save Status Indicator */}
          {saveStatus === 'saving' && (
            <div
              className="flex items-center gap-2 text-sm text-gray-500"
              data-testid="dashboard-save-status-saving"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="hidden xl:inline">Saving...</span>
            </div>
          )}
          {saveStatus === 'saved' && (
            <div
              className="flex items-center gap-2 text-sm text-green-600"
              data-testid="dashboard-save-status-saved"
            >
              <Check className="w-4 h-4" />
              <span className="hidden xl:inline">Saved</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div
              className="flex items-center gap-2 text-sm text-red-600"
              data-testid="dashboard-save-status-error"
            >
              <AlertCircle className="w-4 h-4" />
              <span className="hidden xl:inline">{saveError || 'Save failed'}</span>
            </div>
          )}

          <Button onClick={onSave} size="sm" data-testid="dashboard-save-btn">
            <Save className="w-4 h-4 mr-2" />
            <span className="hidden lg:inline">Save</span>
          </Button>

          {/* Save changes and return to dashboard view mode. */}
          {onPreview && (
            <Button
              size="sm"
              variant="outline"
              onClick={onPreview}
              disabled={isNavigating}
              data-testid="dashboard-preview-btn"
              className="min-w-[104px] justify-center px-4"
              aria-label={isNavigating ? 'Saving and opening dashboard view' : 'View dashboard'}
            >
              {isNavigating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              <span>{isNavigating ? 'Saving and opening view...' : 'View'}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
