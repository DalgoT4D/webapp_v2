'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Edit3, X, RotateCcw, EyeOff, Type } from 'lucide-react';
import {
  resolveChartTitle,
  isTitleOverridden,
  getTitleEditorValue,
  createTitleUpdateConfig,
  type ChartData,
  type ChartTitleConfig,
} from '@/lib/chart-title-utils';

interface ChartTitleEditorProps {
  chartData: ChartData | null | undefined;
  config: ChartTitleConfig;
  onTitleChange: (newConfig: ChartTitleConfig) => void;
  isEditMode?: boolean;
  className?: string;
}

export function ChartTitleEditor({
  chartData,
  config,
  onTitleChange,
  isEditMode = false,
  className,
}: ChartTitleEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const resolvedTitle = resolveChartTitle(chartData, config);
  const isOverridden = isTitleOverridden(chartData, config);
  const showTitle = config.showTitle !== false;

  // Initialize edit value when editing starts
  useEffect(() => {
    if (isEditing) {
      const editorValue = getTitleEditorValue(chartData, config);
      setEditValue(editorValue);
      // Focus input after state update
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isEditing, chartData, config]);

  const handleStartEdit = () => {
    if (!isEditMode) return;
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmedValue = editValue.trim();

    if (trimmedValue === chartData?.title) {
      // Same as original - remove override
      onTitleChange(createTitleUpdateConfig(null));
    } else {
      // Set custom title (could be empty string)
      onTitleChange(createTitleUpdateConfig(editValue));
    }

    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const handleRevertToOriginal = () => {
    onTitleChange(createTitleUpdateConfig(null));
  };

  const handleHideTitle = () => {
    onTitleChange(createTitleUpdateConfig(''));
  };

  const handleShowTitle = () => {
    // Restore to original title or default if never had one
    const originalTitle = chartData?.title || 'Untitled Chart';
    onTitleChange(createTitleUpdateConfig(originalTitle));
  };

  // If not in edit mode, just render the title
  if (!isEditMode) {
    return resolvedTitle && showTitle ? (
      <h3 className={cn('chart-title text-lg font-semibold text-gray-900 mb-3', className)}>
        {resolvedTitle}
      </h3>
    ) : null;
  }

  // Edit mode - show interactive editor
  return (
    <div className={cn('chart-title-editor mb-3', className)}>
      {isEditing ? (
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={handleKeyDown}
            placeholder="Enter chart title (leave empty to hide)"
            className="text-lg font-semibold"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancelEdit}
            className="p-1"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="group relative">
          {/* Title Display - Simple click to edit */}
          {showTitle && resolvedTitle ? (
            <div className="flex items-center justify-between group/title">
              <div
                className={cn(
                  'flex-1 min-h-[2rem] flex items-center cursor-text rounded px-2 py-1 -mx-2 -my-1',
                  'hover:bg-gray-50 transition-colors'
                )}
                onClick={handleStartEdit}
                title="Click to edit title"
              >
                <span className="text-lg font-semibold text-gray-900">{resolvedTitle}</span>
              </div>
              {/* Small hide title button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleHideTitle}
                className="h-5 w-5 p-0 opacity-0 group-hover/title:opacity-100 transition-opacity ml-2"
                title="Hide title"
              >
                <EyeOff className="w-3 h-3 text-gray-500" />
              </Button>
            </div>
          ) : showTitle ? (
            <div
              className={cn(
                'min-h-[2rem] flex items-center cursor-text rounded px-2 py-1 -mx-2 -my-1',
                'hover:bg-gray-50 transition-colors text-gray-400 italic'
              )}
              onClick={handleStartEdit}
              title="Click to add title"
            >
              <span className="text-lg font-medium">Click to add title</span>
            </div>
          ) : (
            // Title is hidden - show compact "Show Title" button
            <div className="flex items-center min-h-[1rem]">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleShowTitle}
                className="h-5 px-2 text-xs text-gray-500 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Show title"
              >
                <Type className="w-3 h-3 mr-1" />
                Show title
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Helper text for overridden titles */}
      {!isEditing && isOverridden && (
        <div className="text-xs text-gray-500 mt-1">
          Custom title • Original: "{chartData?.title || 'Untitled Chart'}"
        </div>
      )}
    </div>
  );
}
