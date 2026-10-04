'use client';

import { Copy, MoreVertical, Settings, Star, StarOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { useRbac } from '@/lib/rbac';
import {
  canDeleteListRow,
  getRolePermissions,
} from '@/components/access/logic/resource-permissions';
import type { DashboardListItem } from './dashboard-list-logic';

interface DashboardRowMenuProps {
  dashboard: DashboardListItem;
  isPersonalLanding: boolean;
  isOrgDefault: boolean;
  canManageOrgDefault: boolean;
  hasPermission: ReturnType<typeof useRbac>['hasPermission'];
  isLandingPageLoading: boolean;
  isDuplicating: boolean;
  isDeleting: boolean;
  onSetMyLanding: (dashboardId: number) => void;
  onRemoveMyLanding: () => void;
  onMakeOrgDefault: (dashboardId: number) => void;
  onDuplicate: (dashboardId: number, dashboardTitle: string) => void;
  onDelete: (dashboardId: number, dashboardTitle: string) => void;
}

/** The ⋮ menu of a dashboard row: landing page, duplicate, delete (with confirm dialog). */
export function DashboardRowMenu({
  dashboard,
  isPersonalLanding,
  isOrgDefault,
  canManageOrgDefault,
  hasPermission,
  isLandingPageLoading,
  isDuplicating,
  isDeleting,
  onSetMyLanding,
  onRemoveMyLanding,
  onMakeOrgDefault,
  onDuplicate,
  onDelete,
}: DashboardRowMenuProps) {
  const dashboardRole = getRolePermissions('dashboard', hasPermission);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 p-0 hover:bg-gray-100"
          data-testid={`dashboard-list-menu-${dashboard.id}`}
        >
          <MoreVertical className="w-4 h-4 text-gray-600" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Landing page controls */}
        {(dashboardRole.canView || canManageOrgDefault) && (
          <>
            <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
              Landing Page
            </div>
            {dashboardRole.canView && (
              <>
                {isPersonalLanding ? (
                  <DropdownMenuItem
                    onClick={() => onRemoveMyLanding()}
                    disabled={isLandingPageLoading}
                    data-testid={`dashboard-list-remove-landing-${dashboard.id}`}
                    className="cursor-pointer"
                  >
                    <StarOff className="w-4 h-4 mr-2" />
                    Remove as my landing page
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => onSetMyLanding(dashboard.id)}
                    disabled={isLandingPageLoading}
                    data-testid={`dashboard-list-set-landing-${dashboard.id}`}
                    className="cursor-pointer"
                  >
                    <Star className="w-4 h-4 mr-2" />
                    Set as my landing page
                  </DropdownMenuItem>
                )}
              </>
            )}
            {canManageOrgDefault && (
              <DropdownMenuItem
                onClick={() => onMakeOrgDefault(dashboard.id)}
                disabled={isLandingPageLoading || isOrgDefault}
                data-testid={`dashboard-list-set-org-default-${dashboard.id}`}
                className="cursor-pointer"
              >
                <Settings className="w-4 h-4 mr-2" />
                {isOrgDefault ? 'Current org default' : 'Set as org default'}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}
        {dashboardRole.canCreate && (
          <DropdownMenuItem
            onClick={() => onDuplicate(dashboard.id, dashboard.title || dashboard.dashboard_title)}
            className="cursor-pointer"
            disabled={isDuplicating}
            data-testid={`dashboard-list-duplicate-${dashboard.id}`}
          >
            {isDuplicating ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                Duplicating...
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </>
            )}
          </DropdownMenuItem>
        )}
        {canDeleteListRow('dashboard', dashboardRole.canDelete, dashboard.access_level) && (
          <>
            <DropdownMenuSeparator />
            {/* PINNED-BUGS: "After Cancel in delete dialog, row menu stays open and blocks clicks" — AlertDialog nested in the menu item (onSelect preventDefault) */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onSelect={(e) => e.preventDefault()}
                  data-testid={`dashboard-list-delete-${dashboard.id}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent data-testid={`dashboard-list-delete-dialog-${dashboard.id}`}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{dashboard.title || dashboard.dashboard_title}
                    "? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid={`dashboard-list-delete-cancel-${dashboard.id}`}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      onDelete(dashboard.id, dashboard.title || dashboard.dashboard_title)
                    }
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid={`dashboard-list-delete-confirm-${dashboard.id}`}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
