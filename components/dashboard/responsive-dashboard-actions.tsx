'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Share2, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

interface ResponsiveDashboardActionsProps {
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh?: () => void;
  canEdit: boolean;
  canShare?: boolean;
  isDeleting?: boolean;
  isRefreshing?: boolean;
  dashboardTitle?: string;
  className?: string;
  /** This component mounts twice in dashboard-native-view.tsx (one CSS-hidden per breakpoint,
   * both resolving `isDesktop` the same way since they share the same hook) — set true on the
   * CSS-hidden instance so `data-testid="dashboard-share-btn"` stays unique in the DOM. */
  suppressShareTestId?: boolean;
}

export function ResponsiveDashboardActions({
  onShare,
  onEdit,
  onDelete,
  onRefresh,
  canEdit,
  canShare = true,
  isDeleting = false,
  isRefreshing = false,
  dashboardTitle = 'this dashboard',
  className,
  suppressShareTestId = false,
}: ResponsiveDashboardActionsProps) {
  const responsive = useResponsiveLayout();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Desktop: Show individual buttons (existing behavior)
  if (responsive.isDesktop) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {canShare && (
          <Button
            variant="outline"
            size="sm"
            onClick={onShare}
            aria-label="Share dashboard"
            data-testid={suppressShareTestId ? undefined : 'dashboard-share-btn'}
          >
            <Share2 className="w-4 h-4" />
          </Button>
        )}
        {canEdit && (
          <>
            <Button
              onClick={onEdit}
              size="sm"
              data-testid={suppressShareTestId ? 'dashboard-edit-btn-mobile' : 'dashboard-edit-btn'}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Dashboard
            </Button>
          </>
        )}
      </div>
    );
  }

  // Mobile/Tablet: Use compact dropdown menu
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="p-2"
            data-testid={
              suppressShareTestId
                ? 'dashboard-actions-menu-trigger-mobile'
                : 'dashboard-actions-menu-trigger'
            }
          >
            <MoreVertical className="w-4 h-4" />
            <span className="sr-only">Dashboard actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {canShare && (
            <DropdownMenuItem
              onClick={onShare}
              data-testid={
                suppressShareTestId
                  ? 'dashboard-actions-share-item-mobile'
                  : 'dashboard-actions-share-item'
              }
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Dashboard
            </DropdownMenuItem>
          )}

          {canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onEdit}
                data-testid={
                  suppressShareTestId
                    ? 'dashboard-actions-edit-item-mobile'
                    : 'dashboard-actions-edit-item'
                }
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Dashboard
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
