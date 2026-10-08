'use client';

import { Settings, Star, StarOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface LandingMenuState {
  isPersonalLanding: boolean;
  isOrgDefault: boolean;
  canManageOrgDefault: boolean;
  isLoading: boolean;
  onSetPersonal: () => void;
  onRemovePersonal: () => void;
  onSetOrgDefault: () => void;
}

/** The compact trigger adds `px-3 py-1`; compact testids end in "-mobile". */
const TRIGGER_CLASSES = {
  compact: 'px-3 py-1 text-xs border-green-600 text-green-600 bg-white hover:bg-green-50',
  full: 'text-xs border-green-600 text-green-600 bg-white hover:bg-green-50',
};

/** "Set Landing" dropdown of the dashboard view header (personal landing + org default). */
export function LandingPageMenu({
  variant,
  landing,
}: {
  variant: 'compact' | 'full';
  landing: LandingMenuState;
}) {
  const suffix = variant === 'compact' ? '-mobile' : '';
  const {
    isPersonalLanding,
    isOrgDefault,
    canManageOrgDefault,
    isLoading,
    onSetPersonal,
    onRemovePersonal,
    onSetOrgDefault,
  } = landing;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            TRIGGER_CLASSES[variant],
            (isPersonalLanding || isOrgDefault) && 'bg-blue-50 border-blue-200 text-blue-700'
          )}
          disabled={isLoading}
          data-testid={`dashboard-view-landing-trigger${suffix}`}
        >
          {isPersonalLanding ? 'My Landing' : isOrgDefault ? 'Org Default' : 'Set Landing'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">Landing Page</div>
        <DropdownMenuSeparator />

        {isPersonalLanding ? (
          <DropdownMenuItem
            onClick={onRemovePersonal}
            disabled={isLoading}
            data-testid={`dashboard-view-landing-remove${suffix}`}
          >
            <StarOff className="w-4 h-4 mr-2" />
            Remove as my landing page
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={onSetPersonal}
            disabled={isLoading}
            data-testid={`dashboard-view-landing-set${suffix}`}
          >
            <Star className="w-4 h-4 mr-2" />
            Set as my landing page
          </DropdownMenuItem>
        )}

        {canManageOrgDefault && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground">Organization Default</div>
            <DropdownMenuItem
              onClick={onSetOrgDefault}
              disabled={isLoading || isOrgDefault}
              data-testid={`dashboard-view-landing-org-default${suffix}`}
            >
              <Settings className="w-4 h-4 mr-2" />
              {isOrgDefault ? 'Current org default' : 'Set as org default'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
