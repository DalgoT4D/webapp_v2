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

/** Desktop view header (`hidden lg:block`); see DashboardViewHeader for how it differs from the compact one. */
export function ViewHeaderFull({
  dashboard,
  isFullscreen,
  isPublicMode,
  isReportMode,
  isLocked,
  isLockedByOther,
  lockedBy,
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
    <div className="hidden lg:block px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {!isFullscreen && !isPublicMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              data-testid="dashboard-view-back-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          <div className="min-w-0 flex-1">
            {/* Title row: title + badges + modified-by/last-updated inline */}
            <div className="flex items-center gap-3 min-w-0">
              {(!isPublicMode || isFullscreen) && (
                <h1 className="text-2xl font-bold text-gray-900 dashboard-header-title truncate flex-shrink-0 max-w-md">
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
                  {isLockedByOther ? `Locked by ${lockedBy}` : `Locked by you`}
                </Badge>
              )}
              {dashboard.last_modified_by && (
                <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                  <User className="w-3 h-3" />
                  <span>Updated by {dashboard.last_modified_by}</span>
                </div>
              )}
              {dashboard.updated_at && (
                <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>
                    Modified{' '}
                    {formatDistanceToNow(new Date(dashboard.updated_at), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>

            {/* Subtitle / description below the title */}
            {dashboard.description && (!isPublicMode || isFullscreen) && (
              <p
                className="text-sm text-gray-600 mt-1 line-clamp-2 max-w-3xl"
                data-testid="dashboard-description"
              >
                {dashboard.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isPublicMode && !isReportMode && (
            <RequestEditPill
              rtype="dashboard"
              resourceId={dashboard.id}
              resourceAccessLevel={dashboard.access_level}
            />
          )}
          {/* Landing page controls */}
          {!isPublicMode && <LandingPageMenu variant="full" landing={landing} />}

          {/* Action buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleFullscreen}
            data-testid="dashboard-view-fullscreen-btn"
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

          {!isPublicMode && (
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
            />
          )}
        </div>
      </div>
    </div>
  );
}
