'use client';

import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Filter, ChevronDown, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { UnifiedFiltersPanel } from './unified-filters-panel';
import type { AppliedFilters, DashboardFilterConfig } from '@/types/dashboard-filters';

interface ResponsiveFiltersSectionProps {
  dashboardFilters: DashboardFilterConfig[];
  dashboardId: number;
  isEditMode?: boolean;
  onFiltersApplied?: (filters: AppliedFilters) => void;
  onFiltersCleared?: () => void;
  isPublicMode?: boolean;
  publicToken?: string;
  appliedFiltersCount?: number;
  className?: string;
}

export function ResponsiveFiltersSection({
  dashboardFilters,
  dashboardId,
  isEditMode = false,
  onFiltersApplied,
  onFiltersCleared,
  isPublicMode = false,
  publicToken,
  appliedFiltersCount = 0,
  className,
}: ResponsiveFiltersSectionProps) {
  const responsive = useResponsiveLayout();

  // Don't render if no filters
  if (!dashboardFilters.length) {
    return null;
  }

  // Desktop: Don't render here - filters will be handled by the main layout as vertical sidebar
  if (responsive.isDesktop) {
    return null;
  }

  // Mobile/Tablet: Use accordion-style filters
  return (
    <div className={className}>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="filters" className="border-b-0">
          <AccordionTrigger className="hover:no-underline py-3 px-4 bg-muted/20 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filters</span>
              {appliedFiltersCount > 0 && (
                <span className="text-sm text-muted-foreground">
                  • {appliedFiltersCount} applied
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-3 pb-0">
            <div className="border rounded-lg bg-background p-3">
              <UnifiedFiltersPanel
                initialFilters={dashboardFilters}
                dashboardId={dashboardId}
                isEditMode={isEditMode}
                layout="horizontal" // Always use horizontal in collapsed mode for better mobile experience
                onFiltersApplied={onFiltersApplied}
                onFiltersCleared={onFiltersCleared}
                isPublicMode={isPublicMode}
                publicToken={publicToken}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
