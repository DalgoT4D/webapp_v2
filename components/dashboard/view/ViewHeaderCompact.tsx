'use client';

import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Clock, Lock, Maximize2, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RequestEditPill } from '@/components/access/request-edit-pill';
import { EmbedCodeDropdown } from '@/components/dashboard/embed-code-dropdown';
import { ResponsiveDashboardActions } from '@/components/dashboard/responsive-dashboard-actions';
import { LandingPageMenu } from './LandingPageMenu';
import type { ViewHeaderProps } from './DashboardViewHeader';

/** Mobile view header (`lg:hidden`); see DashboardViewHeader for how it differs from the full one. */
export function ViewHeaderCompact({
  dashboard,
  isFullscreen,
  isPublicMode,
  isReportMode,
  isLocked,
  isLockedByOther,
  landing,
  canEdit,
  isDeleting,
  isRefreshing,
  onBack,
  onToggleFullscreen,
  onShare,
  onEdit,
  onDelete,
  onRefresh,
}: ViewHeaderProps) {
  return (
    <div className="lg:hidden">
      {/* Mobile Top Row */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {!isFullscreen && !isPublicMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="p-1 flex-shrink-0"
              data-testid="dashboard-view-back-btn-mobile"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {(!isPublicMode || isFullscreen) && (
                <h1 className="text-lg font-bold text-gray-900 truncate dashboard-header-title">
                  {dashboard.title}
                </h1>
              )}
              {dashboard.is_published && (
                <Badge
                  variant="default"
                  className="text-xs bg-green-100 text-green-800 flex-shrink-0"
                >
                  Published
                </Badge>
              )}
              {isLocked && (
                <Badge
                  variant={isLockedByOther ? 'destructive' : 'secondary'}
                  className="text-xs flex-shrink-0"
                >
                  <Lock className="w-3 h-3 mr-1" />
                  Locked
                </Badge>
              )}
            </div>
            {dashboard.description && (!isPublicMode || isFullscreen) && (
              <p className="text-xs text-gray-600 mt-1 truncate">{dashboard.description}</p>
            )}
          </div>
        </div>

        {/* Mobile Quick Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isPublicMode && !isReportMode && (
            <RequestEditPill
              rtype="dashboard"
              resourceId={dashboard.id}
              resourceAccessLevel={dashboard.access_level}
            />
          )}
          {!isPublicMode && <LandingPageMenu variant="compact" landing={landing} />}
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleFullscreen}
            className="p-1.5"
            data-testid="dashboard-view-fullscreen-btn-mobile"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>

          {/* PINNED-BUGS: "Embed code dropdown never renders — `GET /api/dashboards/<id>/` doesn't return `public_share_token`" */}
          {!isPublicMode && dashboard?.public_share_token && (
            <EmbedCodeDropdown
              token={dashboard.public_share_token}
              dashboardTitle={dashboard?.title ?? ''}
              dashboardId={dashboard?.id}
            />
          )}
        </div>
      </div>

      {/* Responsive Action Row */}
      {!isPublicMode && (
        <div className="px-4 pb-2">
          <ResponsiveDashboardActions
            onShare={onShare}
            onEdit={onEdit}
            onDelete={onDelete}
            onRefresh={onRefresh}
            canEdit={canEdit && !isLockedByOther}
            canShare={canEdit}
            isDeleting={isDeleting}
            isRefreshing={isRefreshing}
            dashboardTitle={dashboard?.title}
            className="justify-end"
            suppressShareTestId
          />
        </div>
      )}

      {/* Mobile Metadata Row */}
      <div className="px-4 pb-2 flex items-center gap-4 text-xs text-gray-500 border-t pt-2">
        {dashboard.last_modified_by && (
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span className="truncate">Updated by {dashboard.last_modified_by}</span>
          </div>
        )}
        {dashboard.updated_at && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>
              Modified {formatDistanceToNow(new Date(dashboard.updated_at), { addSuffix: true })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
