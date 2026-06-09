'use client';

import { useState, useCallback, useRef, useEffect, memo, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DashboardTab } from '@/types/dashboard';
import { TAB_TITLE_MAX_LENGTH, createNewTab, getNextTabNumber } from './tab-utils';
import { DeleteTabDialog } from './DeleteTabDialog';

interface TabBarProps {
  tabs: DashboardTab[];
  activeTabId: string;
  isEditMode: boolean;
  onTabChange: (tabId: string) => void;
  onTabAdd: (newTab: DashboardTab) => void;
  onTabRemove: (tabId: string) => void;
  onTabRename: (tabId: string, newTitle: string) => void;
  className?: string;
}

interface TabItemProps {
  tab: DashboardTab;
  isActive: boolean;
  isEditMode: boolean;
  isOnlyTab: boolean;
  onSelect: (tabId: string) => void;
  onRemove: (tabId: string) => void;
  onRename: (tabId: string, newTitle: string) => void;
}

// Individual Tab Item Component
const TabItem = memo(function TabItem({
  tab,
  isActive,
  isEditMode,
  isOnlyTab,
  onSelect,
  onRemove,
  onRename,
}: TabItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tab.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Handle click to select tab
  const handleClick = useCallback(() => {
    if (!isEditing) {
      onSelect(tab.id);
    }
  }, [isEditing, onSelect, tab.id]);

  // Handle single click on title to start editing
  // Disabled when there is only one tab
  const handleTitleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isEditMode && isActive && !isOnlyTab) {
        e.stopPropagation();
        setEditValue(tab.title);
        setIsEditing(true);
      }
    },
    [isEditMode, isActive, isOnlyTab, tab.title]
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
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); // prevent Space from scrolling the page
        handleClick();
      }
    },
    [handleClick, isEditing]
  );

  // Handle remove button click - show confirmation dialog
  const handleRemoveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowDeleteDialog(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    setShowDeleteDialog(false);
    onRemove(tab.id);
  }, [onRemove, tab.id]);

  return (
    <div
      id={`tab-${tab.id}`}
      data-testid={`tab-item-${tab.id}`}
      className={cn(
        'group relative flex items-center gap-1 px-4 py-2 cursor-pointer',
        'border-b-2 transition-colors duration-150',
        isActive
          ? 'border-primary bg-primary/5 text-primary font-medium'
          : 'border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground'
      )}
      onClick={handleClick}
      onKeyDown={handleTabKeyDown}
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
    >
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
        <button
          type="button"
          className={cn(
            'truncate max-w-32 text-sm bg-transparent border-none p-0',
            isEditMode && isActive && !isOnlyTab
              ? 'cursor-pointer hover:underline'
              : 'cursor-default pointer-events-none'
          )}
          title={tab.title}
          data-testid={`tab-title-${tab.id}`}
          onClick={handleTitleClick}
          aria-label={`Rename ${tab.title} tab`}
          tabIndex={isEditMode && isActive && !isOnlyTab ? 0 : -1}
        >
          {tab.title}
        </button>
      )}

      {/* Remove button - only show in edit mode and when more than 1 tab */}
      {isEditMode && !isOnlyTab && !isEditing && (
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
  className,
}: TabBarProps) {
  const safeTabs = useMemo(() => tabs || [], [tabs]);

  // Handle adding a new tab
  const handleAddTab = useCallback(() => {
    const nextNumber = getNextTabNumber(safeTabs);
    const newTab = createNewTab(nextNumber);
    onTabAdd(newTab);
  }, [safeTabs, onTabAdd]);

  // Check if there's only one tab (cannot remove last tab)
  const isOnlyTab = safeTabs.length === 1;

  return (
    <div
      id="dashboard-tab-bar"
      data-testid="dashboard-tab-bar"
      className={cn(
        'flex items-center border-b bg-background',
        'overflow-x-auto scrollbar-thin scrollbar-thumb-muted',
        className
      )}
      role="tablist"
      aria-label="Dashboard tabs"
    >
      {/* Tab Items */}
      {safeTabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          isEditMode={isEditMode}
          isOnlyTab={isOnlyTab}
          onSelect={onTabChange}
          onRemove={onTabRemove}
          onRename={onTabRename}
        />
      ))}

      {/* Add Tab Button - only show in edit mode */}
      {isEditMode && (
        <Button
          variant="ghost"
          size="sm"
          id="add-tab-btn"
          data-testid="add-tab-btn"
          className="h-8 w-8 p-0 ml-1 flex-shrink-0"
          onClick={handleAddTab}
          aria-label="Add new tab"
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
});

export default TabBar;
