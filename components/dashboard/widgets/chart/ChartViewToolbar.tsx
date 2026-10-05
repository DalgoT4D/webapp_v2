'use client';

import { Download, Eye, FileImage, FileText, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PoweredByDalgoImage } from '@/components/ui/powered-by-dalgo-image';
import { ChartTypes } from '@/types/charts';

interface ChartViewToolbarProps {
  chartId: number;
  onView?: () => void;
  isPublicMode: boolean;
  chartType?: string;
  isFullscreen: boolean;
  onDownloadImage: () => void;
  onDownloadCSV: () => void;
  onToggleFullscreen: () => void;
}

/** The view widget's hover toolbar: View, Download (PNG / CSV), Fullscreen. */
export function ChartViewToolbar({
  chartId,
  onView,
  isPublicMode,
  chartType,
  isFullscreen,
  onDownloadImage,
  onDownloadCSV,
  onToggleFullscreen,
}: ChartViewToolbarProps) {
  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-2 opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
      <div className="flex gap-1 bg-white/90 backdrop-blur rounded-md shadow-sm p-1">
        {onView && !isPublicMode && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            title="View Chart"
            aria-label="View Chart"
            onClick={onView}
            data-testid={`dashboard-chart-view-btn-${chartId}`}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              title="Download"
              data-testid={`dashboard-chart-download-trigger-${chartId}`}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={onDownloadImage}
              className="cursor-pointer"
              data-testid={`dashboard-chart-download-png-${chartId}`}
            >
              <FileImage className="w-4 h-4 mr-2" />
              <span>Download as PNG</span>
            </DropdownMenuItem>
            {chartType !== ChartTypes.NUMBER && (
              <DropdownMenuItem
                onClick={onDownloadCSV}
                className="cursor-pointer"
                data-testid={`dashboard-chart-download-csv-${chartId}`}
              >
                <FileText className="w-4 h-4 mr-2" />
                <span>Export Data as CSV</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleFullscreen}
          className="h-7 w-7 p-0"
          title="Fullscreen"
          data-testid={`dashboard-chart-fullscreen-btn-${chartId}`}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {isFullscreen && (
        <div className="pointer-events-none pr-2">
          <PoweredByDalgoImage imageClassName="max-h-9" />
        </div>
      )}
    </div>
  );
}
