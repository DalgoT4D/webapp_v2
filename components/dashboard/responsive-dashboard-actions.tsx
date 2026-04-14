'use client';

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
  canEdit: boolean;
  className?: string;
}

export function ResponsiveDashboardActions({
  onShare,
  onEdit,
  canEdit,
  className,
}: ResponsiveDashboardActionsProps) {
  const responsive = useResponsiveLayout();

  // Desktop: Show individual buttons
  if (responsive.isDesktop) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Button variant="outline" size="sm" onClick={onShare}>
          <Share2 className="w-4 h-4" />
        </Button>
        {canEdit && (
          <Button onClick={onEdit} size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Edit Dashboard
          </Button>
        )}
      </div>
    );
  }

  // Mobile/Tablet: Use compact dropdown menu
  return (
    <div className={cn('flex items-center gap-2', className)}>
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
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
