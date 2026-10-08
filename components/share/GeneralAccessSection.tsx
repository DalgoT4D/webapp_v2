'use client';

import { Shield } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GeneralAccessMode, GeneralAccessState } from '@/hooks/api/useAccess';
import {
  getGeneralAccessDescription,
  getMaxParentBlockRank,
} from '@/components/share/logic/general-access';
import { PublicLinkSection } from '@/components/share/PublicLinkSection';

interface GeneralAccessSectionProps {
  generalAccess: GeneralAccessState;
  modeChanging: boolean;
  onModeChange: (next: GeneralAccessMode) => void;
  entityLabelLower: string;
  onCopyPublicUrl: () => void;
}

/**
 * Default / Private / Public, restricted by the shared dashboards that contain the resource
 * (`parent_blocks`, computed by the backend).
 * PINNED-BUGS: "Report Public option not limited by the source dashboard's sharing (backend applies it to charts/KPIs only)"
 * PINNED-BUGS: "Charts can't be made Public — backend sends `supports_public=false` (no Public option in share modal)"
 */
export function GeneralAccessSection({
  generalAccess,
  modeChanging,
  onModeChange,
  entityLabelLower,
  onCopyPublicUrl,
}: GeneralAccessSectionProps) {
  const maxParentRank = getMaxParentBlockRank(generalAccess.parent_blocks);
  const anyBlocked = maxParentRank > 0;

  return (
    <div className="rounded-md border p-4">
      <div className="flex items-start gap-3">
        <Shield className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">General access</p>
              <p className="text-xs text-muted-foreground" data-testid="general-access-description">
                {getGeneralAccessDescription(generalAccess)}
              </p>
            </div>
            <Select
              value={generalAccess.mode}
              onValueChange={(v) => onModeChange(v as GeneralAccessMode)}
              disabled={modeChanging}
            >
              <SelectTrigger className="w-32 h-8" data-testid="general-access-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem
                  value="internal"
                  disabled={maxParentRank > 1}
                  data-testid="general-access-option-internal"
                >
                  Default
                </SelectItem>
                <SelectItem
                  value="private"
                  disabled={maxParentRank > 0}
                  data-testid="general-access-option-private"
                >
                  Private
                </SelectItem>
                {generalAccess.supports_public && (
                  <SelectItem
                    value="public"
                    disabled={!generalAccess.allow_public_sharing}
                    data-testid="general-access-option-public"
                  >
                    Public
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          {anyBlocked && (
            <p
              className="text-xs text-muted-foreground mt-2"
              data-testid="general-access-restricted-text"
            >
              Some options are restricted as this resource is used in shared dashboards:{' '}
              <strong>
                {generalAccess.parent_blocks.map((b) => b.dashboard_title).join(', ')}
              </strong>
            </p>
          )}

          {generalAccess.mode === 'public' && generalAccess.allow_public_sharing && (
            <PublicLinkSection
              generalAccess={generalAccess}
              entityLabelLower={entityLabelLower}
              onCopyPublicUrl={onCopyPublicUrl}
            />
          )}
        </div>
      </div>
    </div>
  );
}
