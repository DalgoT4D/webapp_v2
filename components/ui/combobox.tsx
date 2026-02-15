'use client';

import * as React from 'react';
import { Popover, PopoverContent, PopoverAnchor, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Search, ChevronDown } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────

export interface ComboboxItem {
  value: string;
  label: string;
  disabled?: boolean;
  [key: string]: any;
}

interface ComboboxBaseProps {
  items: ComboboxItem[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  noItemsMessage?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  renderItem?: (item: ComboboxItem, isSelected: boolean, searchQuery: string) => React.ReactNode;
}

interface SingleComboboxProps extends ComboboxBaseProps {
  mode?: 'single';
  value?: string;
  onValueChange: (value: string) => void;
  autoFocus?: boolean;
  compact?: boolean;
}

interface MultiComboboxProps extends ComboboxBaseProps {
  mode: 'multi';
  values: string[];
  onValuesChange: (values: string[]) => void;
  compact?: boolean;
  triggerClassName?: string;
}

export type ComboboxProps = SingleComboboxProps | MultiComboboxProps;

// ─── Public component ────────────────────────────────────────

export function Combobox(props: ComboboxProps) {
  if (props.mode === 'multi') return <MultiComboboxInner {...props} />;
  return <SingleComboboxInner {...props} />;
}

// ─── Highlight helper (exported for custom renderItem) ───────

export function highlightText(text: string, query: string) {
  // Handle null/undefined text
  if (!text) return '';
  if (!query || !query.trim()) return text;

  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-yellow-900 font-medium">
          {part}
        </mark>
      ) : (
        part
      )
    );
  } catch (error) {
    // Fallback to plain text if regex fails
    return text;
  }
}

// ═════════════════════════════════════════════════════════════
// Single Mode
// ═════════════════════════════════════════════════════════════

function SingleComboboxInner({
  items = [],
  value,
  onValueChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  noItemsMessage = 'No items available.',
  loading = false,
  disabled = false,
  className,
  id,
  autoFocus = false,
  compact = false,
  renderItem,
}: SingleComboboxProps) {
  const [open, setOpen] = React.useState(autoFocus);
  const [search, setSearch] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Ensure items is always an array
  const safeItems = React.useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const selectedLabel = React.useMemo(
    () => safeItems.find((i) => i?.value === value)?.label ?? '',
    [safeItems, value]
  );

  const filtered = React.useMemo(() => {
    if (!search.trim()) return safeItems;
    const q = search.toLowerCase();
    return safeItems.filter(
      (i) =>
        i &&
        i.label &&
        i.value &&
        (i.label.toLowerCase().includes(q) || i.value.toLowerCase().includes(q))
    );
  }, [safeItems, search]);

  // Reset highlight when list changes
  React.useEffect(() => {
    setHighlightedIndex(-1);
  }, [filtered.length, search]);

  // Auto-focus
  React.useEffect(() => {
    if (autoFocus && inputRef.current && !loading) {
      inputRef.current.focus();
    }
  }, [autoFocus, loading]);

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const els = listRef.current.querySelectorAll('[data-combobox-item]');
      els[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleSelect = React.useCallback(
    (val: string, itemDisabled?: boolean) => {
      if (itemDisabled) return;
      onValueChange(val);
      setSearch('');
      setOpen(false);
    },
    [onValueChange]
  );

  // Find next non-disabled index for keyboard navigation
  const findNextEnabledIndex = (currentIndex: number, direction: 'up' | 'down'): number => {
    const step = direction === 'down' ? 1 : -1;
    let nextIndex = currentIndex + step;
    let attempts = 0;
    const maxAttempts = filtered.length;

    while (attempts < maxAttempts) {
      if (nextIndex < 0) nextIndex = filtered.length - 1;
      if (nextIndex >= filtered.length) nextIndex = 0;
      if (!filtered[nextIndex]?.disabled) return nextIndex;
      nextIndex += step;
      attempts++;
    }
    return -1; // All items are disabled
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((p) => findNextEnabledIndex(p, 'down'));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((p) => findNextEnabledIndex(p, 'up'));
        break;
      case 'Enter':
        e.preventDefault();
        if (
          highlightedIndex >= 0 &&
          filtered[highlightedIndex] &&
          !filtered[highlightedIndex].disabled
        ) {
          handleSelect(filtered[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSearch('');
        break;
    }
  };

  // Show selected label when closed, search text when open
  const displayValue = open ? search : selectedLabel;

  const baseId = id || 'combobox';

  return (
    <Popover
      open={open && !disabled && !loading}
      onOpenChange={(next) => {
        if (!next) {
          setOpen(false);
          setSearch('');
          setHighlightedIndex(-1);
        }
      }}
    >
      <PopoverAnchor asChild>
        <div
          ref={containerRef}
          id={`${baseId}-container`}
          data-testid={`${baseId}-container`}
          className={cn('relative', className)}
        >
          <Search
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none',
              compact ? 'w-3.5 h-3.5' : 'w-4 h-4'
            )}
          />
          <Input
            ref={inputRef}
            id={`${baseId}-input`}
            data-testid={`${baseId}-input`}
            placeholder={loading ? 'Loading...' : searchPlaceholder}
            value={displayValue}
            autoComplete="off"
            onChange={(e) => {
              setSearch(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => {
              if (!disabled && !loading) setOpen(true);
            }}
            onClick={() => {
              if (!open && !disabled && !loading) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            className={cn(
              'pl-9 pr-8 w-full bg-white cursor-pointer',
              compact ? 'h-8 text-xs' : 'h-10'
            )}
            disabled={disabled || loading}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${baseId}-listbox`}
            aria-activedescendant={
              highlightedIndex >= 0 && filtered[highlightedIndex]
                ? `${baseId}-item-${filtered[highlightedIndex].value}`
                : undefined
            }
          />
          <ChevronDown
            data-testid={`${baseId}-chevron`}
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 cursor-pointer transition-transform',
              open && 'rotate-180'
            )}
            onClick={() => {
              if (!disabled && !loading) {
                setOpen(!open);
                if (!open) inputRef.current?.focus();
              }
            }}
          />
        </div>
      </PopoverAnchor>

      <PopoverContent
        className="p-0 shadow-lg border border-gray-200"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          // Don't close when clicking the input/anchor area
          if (containerRef.current?.contains(e.target as Node)) {
            e.preventDefault();
          }
        }}
        style={{ width: 'var(--radix-popper-anchor-width)' }}
      >
        <div
          ref={listRef}
          id={`${baseId}-listbox`}
          data-testid={`${baseId}-listbox`}
          role="listbox"
          className="max-h-[240px] overflow-y-auto overflow-x-hidden"
          onWheel={(e) => e.stopPropagation()}
        >
          {filtered.length === 0 ? (
            <div data-testid={`${baseId}-empty`} className="p-3 text-center text-sm text-gray-500">
              {search.trim() ? emptyMessage : noItemsMessage}
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = item.value === value;
              const isHl = idx === highlightedIndex;
              const isItemDisabled = item.disabled === true;
              return (
                <div
                  key={item.value}
                  id={`${baseId}-item-${item.value}`}
                  data-testid={`${baseId}-item-${item.value}`}
                  data-combobox-item=""
                  data-value={item.value}
                  data-selected={isSelected || undefined}
                  data-highlighted={isHl || undefined}
                  data-disabled={isItemDisabled || undefined}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isItemDisabled}
                  className={cn(
                    'px-3 py-2 text-sm border-b border-gray-100 last:border-b-0 select-none',
                    isItemDisabled
                      ? 'cursor-not-allowed opacity-50 text-gray-400'
                      : 'cursor-pointer',
                    !isItemDisabled && isSelected && 'bg-blue-50 text-blue-900',
                    !isItemDisabled && isHl && !isSelected && 'bg-gray-100',
                    !isItemDisabled && !isSelected && !isHl && 'hover:bg-gray-50'
                  )}
                  onClick={() => handleSelect(item.value, isItemDisabled)}
                  onMouseEnter={() => !isItemDisabled && setHighlightedIndex(idx)}
                >
                  {renderItem ? (
                    renderItem(item, isSelected, search)
                  ) : (
                    <div className="font-mono font-medium">{highlightText(item.label, search)}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ═════════════════════════════════════════════════════════════
// Multi Mode
// ═════════════════════════════════════════════════════════════

function MultiComboboxInner({
  items = [],
  values = [],
  onValuesChange,
  placeholder = 'Choose options...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No options found.',
  noItemsMessage = 'No options available.',
  loading = false,
  disabled = false,
  className,
  id,
  triggerClassName,
  compact = false,
  renderItem,
}: MultiComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Ensure items and values are always arrays
  const safeItems = React.useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const safeValues = React.useMemo(() => (Array.isArray(values) ? values : []), [values]);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return safeItems;
    const q = search.toLowerCase();
    return safeItems.filter(
      (i) =>
        i &&
        i.label &&
        i.value &&
        (i.label.toLowerCase().includes(q) || i.value.toLowerCase().includes(q))
    );
  }, [safeItems, search]);

  const handleToggle = (val: string) => {
    if (safeValues.includes(val)) {
      onValuesChange(safeValues.filter((v) => v !== val));
    } else {
      onValuesChange([...safeValues, val]);
    }
  };

  const baseId = id || 'combobox-multi';

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={`${baseId}-trigger`}
          data-testid={`${baseId}-trigger`}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${baseId}-listbox`}
          disabled={disabled || loading}
          className={cn(
            'w-full justify-between font-normal',
            compact ? 'h-8 text-xs' : 'h-10 text-sm',
            triggerClassName,
            className
          )}
          size={compact ? 'sm' : 'default'}
        >
          <span
            className={cn(
              'truncate normal-case',
              safeValues.length === 0 && 'text-muted-foreground'
            )}
          >
            {loading
              ? 'Loading...'
              : safeValues.length === 0
                ? placeholder
                : `${safeValues.length} selected`}
          </span>
          <ChevronDown
            className={cn('shrink-0 opacity-50', compact ? 'ml-1 h-3 w-3' : 'ml-2 h-4 w-4')}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" onFocusOutside={(e) => e.preventDefault()}>
        <div className="p-2">
          <Input
            id={`${baseId}-search`}
            data-testid={`${baseId}-search`}
            placeholder={searchPlaceholder}
            autoComplete="off"
            className="h-8 mb-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div
            id={`${baseId}-listbox`}
            data-testid={`${baseId}-listbox`}
            role="listbox"
            aria-multiselectable="true"
            className="max-h-48 overflow-auto"
          >
            {loading ? (
              <div
                data-testid={`${baseId}-loading`}
                className="text-xs text-muted-foreground p-2 text-center"
              >
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div
                data-testid={`${baseId}-empty`}
                className="text-xs text-muted-foreground p-2 text-center"
              >
                {search.trim() ? emptyMessage : noItemsMessage}
              </div>
            ) : (
              filtered.map((item) => {
                const isSelected = safeValues.includes(item.value);
                return (
                  <div
                    key={item.value}
                    id={`${baseId}-item-${item.value}`}
                    data-testid={`${baseId}-item-${item.value}`}
                    data-value={item.value}
                    data-selected={isSelected || undefined}
                    role="option"
                    aria-selected={isSelected}
                    className="flex items-center gap-1.5 w-full py-1.5 px-2 hover:bg-gray-100 cursor-pointer rounded"
                    onClick={() => handleToggle(item.value)}
                  >
                    <Checkbox
                      id={`${baseId}-checkbox-${item.value}`}
                      checked={isSelected}
                      onCheckedChange={() => handleToggle(item.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3 w-3"
                    />
                    {renderItem ? (
                      renderItem(item, isSelected, search)
                    ) : (
                      <span className="flex-1 text-xs">{item.label}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
