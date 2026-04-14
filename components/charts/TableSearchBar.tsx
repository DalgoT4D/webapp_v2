'use client';

import { useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TableSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  totalMatches: number;
  onClear: () => void;
}

export function TableSearchBar({
  query,
  onQueryChange,
  totalMatches,
  onClear,
}: TableSearchBarProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClear();
      }
    },
    [onClear]
  );

  return (
    <div
      className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 shadow-sm"
      data-testid="table-search-bar"
    >
      <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <Input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search..."
        className="h-7 w-40 border-0 px-1 text-sm shadow-none focus-visible:ring-0"
        data-testid="table-search-input"
      />

      {/* Match counter */}
      {query.trim() && (
        <span
          className="text-xs text-muted-foreground whitespace-nowrap"
          data-testid="table-search-count"
        >
          {totalMatches} {totalMatches === 1 ? 'match' : 'matches'}
        </span>
      )}

      {/* Clear button */}
      {query.trim() && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClear}
          data-testid="table-search-clear-btn"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
