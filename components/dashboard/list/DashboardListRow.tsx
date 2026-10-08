'use client';

import Link from 'next/link';
import { Edit, Lock, Share2, Star, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PERMISSIONS, type useRbac } from '@/lib/rbac';
import type { OrgUser } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { getDashboardOwner, type DashboardListItem } from './dashboard-list-logic';
import { getRolePermissions, hasEditAccess } from '@/components/access/logic/resource-permissions';
import { DashboardRowMenu } from './DashboardRowMenu';

interface DashboardListRowProps {
  dashboard: DashboardListItem;
  currentUser: OrgUser | null;
  hasPermission: ReturnType<typeof useRbac>['hasPermission'];
  isLandingPageLoading: boolean;
  isDuplicating: boolean;
  isDeleting: boolean;
  onToggleFavorite: (dashboard: DashboardListItem) => void;
  onShare: (dashboard: DashboardListItem) => void;
  onSetMyLanding: (dashboardId: number) => void;
  onRemoveMyLanding: () => void;
  onMakeOrgDefault: (dashboardId: number) => void;
  onDuplicate: (dashboardId: number, dashboardTitle: string) => void;
  onDelete: (dashboardId: number, dashboardTitle: string) => void;
}

/** One dashboard in the /dashboards table (pinned and regular rows look the same). */
export function DashboardListRow({
  dashboard,
  currentUser,
  hasPermission,
  isLandingPageLoading,
  isDuplicating,
  isDeleting,
  onToggleFavorite,
  onShare,
  onSetMyLanding,
  onRemoveMyLanding,
  onMakeOrgDefault,
  onDuplicate,
  onDelete,
}: DashboardListRowProps) {
  const isPersonalLanding = currentUser?.landing_dashboard_id === dashboard.id;
  const isOrgDefault = currentUser?.org_default_dashboard_id === dashboard.id;
  const canManageOrgDefault = hasPermission(PERMISSIONS.CAN_MANAGE_ORG_DEFAULT_DASHBOARD);
  const dashboardRole = getRolePermissions('dashboard', hasPermission);
  const isLocked = dashboard.is_locked;
  const isLockedByOther =
    isLocked && dashboard.locked_by && dashboard.locked_by !== currentUser?.email;
  const isFavorited = dashboard.is_favorite ?? false;
  const navigationUrl = dashboardRole.canView ? `/dashboards/${dashboard.id}` : '#';

  return (
    <TableRow className="hover:bg-gray-50" data-testid={`dashboard-list-row-${dashboard.id}`}>
      {/* Name Column with Star */}
      <TableCell className="py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0 hover:bg-yellow-50"
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite(dashboard);
            }}
            data-testid={`dashboard-list-favorite-${dashboard.id}`}
          >
            {isFavorited ? (
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
            ) : (
              <Star className="w-4 h-4 text-gray-300 hover:text-yellow-400" />
            )}
          </Button>
          <div className="flex flex-col">
            <Link
              href={navigationUrl}
              data-testid={`dashboard-list-title-link-${dashboard.id}`}
              className="font-medium text-lg text-gray-900 hover:text-teal-700 hover:underline"
            >
              {dashboard.title || dashboard.dashboard_title}
            </Link>
            {(isPersonalLanding || isOrgDefault || isLocked) && (
              <div className="flex items-center gap-2 mt-1">
                {isPersonalLanding && (
                  <Badge
                    variant="default"
                    className="text-sm bg-blue-100 text-blue-700 border-blue-200"
                  >
                    My Landing
                  </Badge>
                )}
                {isOrgDefault && (
                  <Badge
                    variant="outline"
                    className="text-sm bg-emerald-50 text-emerald-700 border-emerald-200"
                  >
                    Org Default
                  </Badge>
                )}
                {isLocked && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-sm',
                      isLockedByOther
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    )}
                  >
                    <Lock className="w-3 h-3 mr-1" />
                    {isLockedByOther ? 'Locked' : 'By You'}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </TableCell>

      {/* Owner Column */}
      <TableCell className="py-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
            <User className="w-3 h-3 text-gray-600" />
          </div>
          <span className="text-base text-gray-700">{getDashboardOwner(dashboard)}</span>
        </div>
      </TableCell>

      {/* Last Modified Column */}
      <TableCell className="py-4 text-base text-gray-600">
        {dashboard.updated_at
          ? formatDistanceToNow(new Date(dashboard.updated_at), { addSuffix: true })
          : 'Unknown'}
      </TableCell>

      {/* Actions Column */}
      <TableCell className="py-4">
        <div className="flex items-center gap-2">
          {hasEditAccess(dashboard.access_level) && (
            <Link href={`/dashboards/${dashboard.id}/edit`}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 hover:bg-gray-100"
                data-testid={`dashboard-list-edit-${dashboard.id}`}
              >
                <Edit className="w-4 h-4 text-gray-600" />
              </Button>
            </Link>
          )}
          {hasEditAccess(dashboard.access_level) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0 hover:bg-gray-100"
              onClick={() => onShare(dashboard)}
              aria-label={`Share dashboard: ${dashboard.title || dashboard.id}`}
              data-testid={`dashboard-share-table-${dashboard.id}`}
            >
              <Share2 className="w-4 h-4 text-gray-600" />
            </Button>
          )}
          <DashboardRowMenu
            dashboard={dashboard}
            isPersonalLanding={isPersonalLanding}
            isOrgDefault={isOrgDefault}
            canManageOrgDefault={canManageOrgDefault}
            hasPermission={hasPermission}
            isLandingPageLoading={isLandingPageLoading}
            isDuplicating={isDuplicating}
            isDeleting={isDeleting}
            onSetMyLanding={onSetMyLanding}
            onRemoveMyLanding={onRemoveMyLanding}
            onMakeOrgDefault={onMakeOrgDefault}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}
