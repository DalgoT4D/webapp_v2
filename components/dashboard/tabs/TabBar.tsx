'use client';

import { useState, useCallback, useRef, useEffect, memo, useMemo } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import type { DashboardTab } from '@/types/dashboard';
import { TAB_TITLE_MAX_LENGTH, createNewTab, getNextTabNumber } from './tab-utils';
import { DeleteTabDialog } from './DeleteTabDialog';

const TAB_BAR_SCROLL_EDGE_PX = 48;
const TAB_BAR_SCROLL_STEP_PX = 16;
const TAB_REORDER_ACTIVATION_DISTANCE_PX = 6;

function scrollTabBarHorizontally(bar: HTMLDivElement, clientX: number, clientY: number): void {
  const rect = bar.getBoundingClientRect();
  const hasHorizontalOverflow = bar.scrollWidth > bar.clientWidth;
  const isPointerInsideVertically = clientY >= rect.top && clientY <= rect.bottom;
  if (!hasHorizontalOverflow || !isPointerInsideVertically) return;

  if (clientX < rect.left + TAB_BAR_SCROLL_EDGE_PX) {
    bar.scrollLeft -= TAB_BAR_SCROLL_STEP_PX;
  } else if (clientX > rect.right - TAB_BAR_SCROLL_EDGE_PX) {
    bar.scrollLeft += TAB_BAR_SCROLL_STEP_PX;
  }
}

interface TabBarProps {
  tabs: DashboardTab[];
  activeTabId: string;
  isEditMode: boolean;
  onTabChange: (tabId: string) => void;
  onTabAdd: (newTab: DashboardTab) => void;
  onTabRemove: (tabId: string) => void;
  onTabRename: (tabId: string, newTitle: string) => void;
  onTabReorder?: (tabId: string, toIndex: number) => void;
  dragTargetTabId?: string | null;
  isWidgetDragging?: boolean;
  className?: string;
}

interface TabItemProps {
  tab: DashboardTab;
  isActive: boolean;
  isEditMode: boolean;
  isOnlyTab: boolean;
  isDropTarget: boolean;
  isReordering: boolean;
  reorderPosition: 'before' | 'after' | null;
  canReorder: boolean;
  isInteractionDisabled: boolean;
  onSelect: (tabId: string) => void;
  onRemove: (tabId: string) => void;
  onRename: (tabId: string, newTitle: string) => void;
  onMove: (tabId: string, direction: -1 | 1) => void;
}

// Individual Tab Item Component
const TabItem = memo(function TabItem({
  tab,
  isActive,
  isEditMode,
  isOnlyTab,
  isDropTarget,
  isReordering,
  reorderPosition,
  canReorder,
  isInteractionDisabled,
  onSelect,
  onRemove,
  onRename,
  onMove,
}: TabItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tab.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLButtonElement>(null);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: tab.id,
    disabled: !canReorder || isEditing,
  });

  useEffect(() => {
    const title = titleRef.current;
    if (!title) return undefined;
    const measure = () => setIsTitleTruncated(title.scrollWidth > title.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(title);
    return () => observer.disconnect();
  }, [tab.title, isEditMode]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handle click to select tab
  const handleClick = useCallback(() => {
    if (!isEditing && !isInteractionDisabled) {
      onSelect(tab.id);
    }
  }, [isEditing, isInteractionDisabled, onSelect, tab.id]);

  // Handle single click on title to start editing
  const handleTitleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isEditMode && isActive && !isInteractionDisabled) {
        e.stopPropagation();
        setEditValue(tab.title);
        setIsEditing(true);
      }
    },
    [isEditMode, isActive, isInteractionDisabled, tab.title]
  );

  // Handle rename completion
  const handleRenameComplete = useCallback(() => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== tab.title) {
      onRename(tab.id, trimmedValue.substring(0, TAB_TITLE_MAX_LENGTH));
    } else {
      setEditValue(tab.title);
    }
    setIsEditing(false);
  }, [editValue, tab.title, tab.id, onRename]);

  // Handle key events in input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleRenameComplete();
      } else if (e.key === 'Escape') {
        setEditValue(tab.title);
        setIsEditing(false);
      }
    },
    [handleRenameComplete, tab.title]
  );

  // Handle keyboard activation (Enter/Space) for accessibility
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isEditing) return; // let the rename input handle its own keys
      if (!isInteractionDisabled && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        onMove(tab.id, e.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); // prevent Space from scrolling the page
        handleClick();
      }
    },
    [handleClick, isEditing, isInteractionDisabled, onMove, tab.id]
  );

  // Handle remove button click - show confirmation dialog
  const handleRemoveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowDeleteDialog(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    setShowDeleteDialog(false);
    trackEvent(ANALYTICS_EVENTS.DASHBOARD_TAB_DELETED);
    onRemove(tab.id);
  }, [onRemove, tab.id]);

  return (
    <div
      ref={setNodeRef}
      id={`tab-${tab.id}`}
      data-testid={`tab-item-${tab.id}`}
      data-dashboard-tab-id={tab.id}
      className={cn(
        'group relative flex min-w-[120px] max-w-full flex-[0_1_auto] items-center gap-1 px-4 py-2',
        'border-b-2 transition-colors duration-150',
        canReorder ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isReordering && 'opacity-50',
        isDropTarget && 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-inset ring-blue-300',
        isActive
          ? 'border-primary bg-primary/5 text-primary font-medium'
          : 'border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground'
      )}
      onClick={handleClick}
      onKeyDown={handleTabKeyDown}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...(canReorder && !isEditing ? attributes : {})}
      {...(canReorder && !isEditing ? listeners : {})}
      role="tab"
      aria-selected={isActive}
      aria-roledescription={canReorder ? 'reorderable dashboard tab' : undefined}
      aria-keyshortcuts={canReorder ? 'Alt+ArrowLeft Alt+ArrowRight' : undefined}
      tabIndex={0}
    >
      {reorderPosition && (
        <span
          data-testid={`tab-reorder-indicator-${tab.id}`}
          className={cn(
            'pointer-events-none absolute inset-y-1 w-0.5 rounded-full bg-primary',
            reorderPosition === 'before' ? 'left-0' : 'right-0'
          )}
          aria-hidden="true"
        />
      )}
      {isEditing ? (
        <Input
          ref={inputRef}
          id={`tab-input-${tab.id}`}
          data-testid={`tab-rename-input-${tab.id}`}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleRenameComplete}
          onKeyDown={handleKeyDown}
          className="h-6 w-32 px-1 py-0 text-sm"
          maxLength={TAB_TITLE_MAX_LENGTH}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              ref={titleRef}
              type="button"
              className={cn(
                'min-w-0 max-w-full flex-1 truncate whitespace-nowrap text-sm bg-transparent border-none p-0',
                isEditMode && isActive ? 'cursor-pointer hover:underline' : 'cursor-default'
              )}
              data-testid={`tab-title-${tab.id}`}
              onClick={handleTitleClick}
              aria-label={
                isEditMode && isActive ? `Rename ${tab.title} tab` : `Select ${tab.title} tab`
              }
              tabIndex={isEditMode && isActive ? 0 : -1}
            >
              {tab.title}
            </button>
          </TooltipTrigger>
          {isTitleTruncated && <TooltipContent side="bottom">{tab.title}</TooltipContent>}
        </Tooltip>
      )}

      {/* Remove button - only show in edit mode and when more than 1 tab */}
      {isEditMode && !isOnlyTab && !isEditing && !isInteractionDisabled && (
        <Button
          variant="ghost"
          size="sm"
          data-testid={`tab-remove-btn-${tab.id}`}
          className="h-5 w-5 p-0 ml-1 hover:bg-destructive/10 hover:text-destructive"
          onClick={handleRemoveClick}
          aria-label={`Remove ${tab.title} tab`}
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      <DeleteTabDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
});

// Main TabBar Component
export const TabBar = memo(function TabBar({
  tabs,
  activeTabId,
  isEditMode,
  onTabChange,
  onTabAdd,
  onTabRemove,
  onTabRename,
  onTabReorder,
  dragTargetTabId = null,
  isWidgetDragging = false,
  className,
}: TabBarProps) {
  const safeTabs = useMemo(() => tabs || [], [tabs]);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [reorderingTabId, setReorderingTabId] = useState<string | null>(null);
  const [reorderTarget, setReorderTarget] = useState<{
    tabId: string;
    position: 'before' | 'after';
  } | null>(null);
  const reorderSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: TAB_REORDER_ACTIVATION_DISTANCE_PX },
    })
  );

  useEffect(() => {
    document.getElementById(`tab-${activeTabId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [activeTabId]);

  useEffect(() => {
    if (!isWidgetDragging) return undefined;
    const handleMouseMove = (event: MouseEvent) => {
      const bar = tabBarRef.current;
      if (!bar) return;
      scrollTabBarHorizontally(bar, event.clientX, event.clientY);
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [isWidgetDragging]);

  // Handle adding a new tab
  const handleAddTab = useCallback(() => {
    const nextNumber = getNextTabNumber(safeTabs);
    const newTab = createNewTab(nextNumber);
    trackEvent(ANALYTICS_EVENTS.DASHBOARD_TAB_CREATED);
    onTabAdd(newTab);
  }, [safeTabs, onTabAdd]);

  const clearReorderState = useCallback(() => {
    setReorderingTabId(null);
    setReorderTarget(null);
  }, []);

  const handleReorderStart = useCallback((event: DragStartEvent) => {
    setReorderingTabId(String(event.active.id));
    setReorderTarget(null);
  }, []);

  const handleReorderOver = useCallback(
    (event: DragOverEvent) => {
      const sourceIndex = safeTabs.findIndex((tab) => tab.id === event.active.id);
      const targetIndex = safeTabs.findIndex((tab) => tab.id === event.over?.id);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        setReorderTarget(null);
        return;
      }
      setReorderTarget({
        tabId: safeTabs[targetIndex].id,
        position: sourceIndex < targetIndex ? 'after' : 'before',
      });
    },
    [safeTabs]
  );

  const handleReorderEnd = useCallback(
    (event: DragEndEvent) => {
      const sourceIndex = safeTabs.findIndex((tab) => tab.id === event.active.id);
      const destinationIndex = safeTabs.findIndex((tab) => tab.id === event.over?.id);
      if (sourceIndex >= 0 && destinationIndex >= 0 && sourceIndex !== destinationIndex) {
        onTabReorder?.(String(event.active.id), destinationIndex);
      }
      clearReorderState();
    },
    [clearReorderState, onTabReorder, safeTabs]
  );

  useEffect(() => {
    if (!reorderingTabId) return undefined;
    const handlePointerMove = (event: PointerEvent) => {
      const bar = tabBarRef.current;
      if (!bar) return;
      scrollTabBarHorizontally(bar, event.clientX, event.clientY);
    };
    document.addEventListener('pointermove', handlePointerMove);
    return () => document.removeEventListener('pointermove', handlePointerMove);
  }, [reorderingTabId]);

  const handleKeyboardMove = useCallback(
    (tabId: string, direction: -1 | 1) => {
      if (!isEditMode || isWidgetDragging || !onTabReorder) return;
      const sourceIndex = safeTabs.findIndex((tab) => tab.id === tabId);
      if (sourceIndex < 0) return;
      const destinationIndex = Math.max(0, Math.min(safeTabs.length - 1, sourceIndex + direction));
      if (destinationIndex !== sourceIndex) onTabReorder(tabId, destinationIndex);
    },
    [isEditMode, isWidgetDragging, onTabReorder, safeTabs]
  );

  // Check if there's only one tab (cannot remove last tab)
  const isOnlyTab = safeTabs.length === 1;

  return (
    <DndContext
      sensors={reorderSensors}
      autoScroll={false}
      onDragStart={handleReorderStart}
      onDragOver={handleReorderOver}
      onDragEnd={handleReorderEnd}
      onDragCancel={clearReorderState}
    >
      <div
        id="dashboard-tab-bar"
        data-testid="dashboard-tab-bar"
        className={cn('flex min-w-0 items-center border-b bg-background', className)}
      >
        <div
          ref={tabBarRef}
          id="dashboard-tab-scroll"
          data-testid="dashboard-tab-scroll"
          className="flex min-w-0 flex-1 items-center overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-muted"
          role="tablist"
          aria-label="Dashboard tabs"
        >
          <SortableContext
            items={safeTabs.map((tab) => tab.id)}
            strategy={horizontalListSortingStrategy}
          >
            {safeTabs.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                isEditMode={isEditMode}
                isOnlyTab={isOnlyTab}
                isDropTarget={tab.id === dragTargetTabId}
                isReordering={tab.id === reorderingTabId}
                reorderPosition={reorderTarget?.tabId === tab.id ? reorderTarget.position : null}
                canReorder={isEditMode && !isWidgetDragging && Boolean(onTabReorder)}
                isInteractionDisabled={isWidgetDragging || Boolean(reorderingTabId)}
                onSelect={onTabChange}
                onRemove={onTabRemove}
                onRename={onTabRename}
                onMove={handleKeyboardMove}
              />
            ))}
          </SortableContext>

          {isEditMode && (
            <Button
              variant="ghost"
              size="sm"
              id="add-tab-btn"
              data-testid="add-tab-btn"
              className="mx-1 h-8 w-8 flex-shrink-0 p-0"
              onClick={handleAddTab}
              aria-label="Add new tab"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </DndContext>
  );
});

export default TabBar;
