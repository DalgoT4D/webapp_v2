'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyStateConfig } from './types';

interface DataTableEmptyStateProps {
  config: EmptyStateConfig;
  hasFilters?: boolean;
  idPrefix?: string;
}

export function DataTableEmptyState({
  config,
  hasFilters = false,
  idPrefix = 'table',
}: DataTableEmptyStateProps) {
  const { icon, title, filteredTitle, action } = config;
  const displayTitle = hasFilters && filteredTitle ? filteredTitle : title;

  return (
    <div
      id={`${idPrefix}-empty-state`}
      className="flex flex-col items-center justify-center h-full gap-4 py-16"
    >
      {icon && (
        <div id={`${idPrefix}-empty-icon`} className="text-muted-foreground">
          {icon}
        </div>
      )}
      <p id={`${idPrefix}-empty-text`} className="text-muted-foreground">
        {displayTitle}
      </p>
      {action &&
        action.visible !== false &&
        !hasFilters &&
        (action.href ? (
          <Link id={`${idPrefix}-empty-create-link`} href={action.href}>
            <Button
              id={`${idPrefix}-empty-create-button`}
              variant="ghost"
              className="text-white hover:opacity-90 shadow-xs"
              style={{ backgroundColor: '#06887b' }}
            >
              {action.icon && (
                <span id={`${idPrefix}-empty-create-icon`} className="mr-2">
                  {action.icon}
                </span>
              )}
              {action.label}
            </Button>
          </Link>
        ) : (
          <Button
            id={`${idPrefix}-empty-create-button`}
            variant="ghost"
            className="text-white hover:opacity-90 shadow-xs"
            style={{ backgroundColor: '#06887b' }}
            onClick={action.onClick}
          >
            {action.icon && (
              <span id={`${idPrefix}-empty-create-icon`} className="mr-2">
                {action.icon}
              </span>
            )}
            {action.label}
          </Button>
        ))}
    </div>
  );
}
