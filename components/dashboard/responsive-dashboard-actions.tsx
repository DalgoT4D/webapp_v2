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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MoreVertical, Share2, Edit, Trash2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

interface ResponsiveDashboardActionsProps {
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh?: () => void;
  canEdit: boolean;
  isDeleting?: boolean;
  isRefreshing?: boolean;
  dashboardTitle?: string;
  className?: string;
}

export function ResponsiveDashboardActions({
  onShare,
  onEdit,
  onDelete,
  onRefresh,
  canEdit,
  isDeleting = false,
  isRefreshing = false,
  dashboardTitle = 'this dashboard',
  className,
}: ResponsiveDashboardActionsProps) {
  const responsive = useResponsiveLayout();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Desktop: Show individual buttons (existing behavior)
  if (responsive.isDesktop) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {/* Refresh button - commented for later use */}
        {/* {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          </Button>
        )} */}
        <Button variant="outline" size="sm" onClick={onShare}>
          <Share2 className="w-4 h-4" />
        </Button>
        {canEdit && (
          <>
            <Button onClick={onEdit} size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Edit Dashboard
            </Button>
            {/* Delete button - commented for later use */}
            {/* <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isDeleting}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{dashboardTitle}"? This action cannot be undone
                    and will permanently remove all dashboard content and configuration.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Dashboard'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog> */}
          </>
        )}
      </div>
    );
  }

  // Mobile/Tablet: Use compact dropdown menu
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Refresh button - commented for later use */}
      {/* {onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2"
        >
          <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
        </Button>
      )} */}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="p-2">
            <MoreVertical className="w-4 h-4" />
            <span className="sr-only">Dashboard actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onShare}>
            <Share2 className="w-4 h-4 mr-2" />
            Share Dashboard
          </DropdownMenuItem>

          {canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Dashboard
              </DropdownMenuItem>
              {/* Delete option - commented for later use */}
              {/* <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
                disabled={isDeleting}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Dashboard
              </DropdownMenuItem> */}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{dashboardTitle}"? This action cannot be undone and
              will permanently remove all dashboard content and configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteDialog(false);
                onDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Dashboard'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
