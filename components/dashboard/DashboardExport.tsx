'use client';

import { useState } from 'react';
import { Download, FileText, Image, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { exportDashboard, type ExportFormat, isExportSupported } from '@/lib/dashboard-export';
import { toast } from 'sonner';

interface DashboardExportProps {
  dashboardTitle: string;
  canvasSelector?: string; // CSS selector for the dashboard canvas
  className?: string;
  variant?: 'button' | 'dropdown' | 'icon';
  showFilters?: boolean; // Whether to include filters in export
}

export function DashboardExport({
  dashboardTitle,
  canvasSelector = '.dashboard-canvas',
  className,
  variant = 'dropdown',
  showFilters = false,
}: DashboardExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeFilters: showFilters,
    quality: 90,
    scale: 2,
  });

  const handleExport = async (format: ExportFormat, customOptions?: any) => {
    if (!isExportSupported()) {
      toast.error('Export is not supported in this environment');
      return;
    }

    setIsExporting(true);

    try {
      let canvasElement = document.querySelector(canvasSelector) as HTMLElement;

      if (!canvasElement) {
        // Try alternative selectors
        const alternativeSelectors = [
          '.dashboard-canvas',
          '.dashboard-grid',
          '.react-grid-layout',
          '[class*="dashboard"]',
        ];

        for (const selector of alternativeSelectors) {
          canvasElement = document.querySelector(selector) as HTMLElement;
          if (canvasElement && canvasElement.offsetWidth > 0) {
            console.log(`Found canvas using fallback selector: ${selector}`);
            break;
          }
        }
      }

      if (!canvasElement) {
        throw new Error('Dashboard canvas not found. Make sure the dashboard is fully loaded.');
      }

      console.log('Using canvas element:', canvasElement);
      console.log('Canvas dimensions:', canvasElement.offsetWidth, 'x', canvasElement.offsetHeight);
      console.log('Canvas class list:', canvasElement.classList.toString());

      // Wait a moment for rendering (removed scrollIntoView to prevent layout changes)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Temporarily apply styles to remove gray borders and extra spacing during export
      // Keep the outer boundary but clean up inner elements
      const originalStyles = new Map();
      const elementsToFix = [...Array.from(canvasElement.querySelectorAll('*'))]; // Exclude canvasElement itself

      // Also handle the canvas element's immediate children for spacing issues
      const immediateChildren = Array.from(canvasElement.children);

      elementsToFix.forEach((el: any) => {
        if (el.style) {
          // Store original styles
          originalStyles.set(el, {
            border: el.style.border,
            borderRadius: el.style.borderRadius,
            boxShadow: el.style.boxShadow,
            marginTop: el.style.marginTop,
            paddingTop: el.style.paddingTop,
          });

          // Apply clean styles for export (only to inner elements)
          el.style.border = 'none';
          el.style.borderRadius = '0';
          el.style.boxShadow = 'none';

          // Remove top spacing from immediate children to eliminate extra space at top
          if (immediateChildren.includes(el)) {
            el.style.marginTop = '0';
            el.style.paddingTop = '0';
          }
        }
      });

      try {
        // Export the element
        await exportDashboard(canvasElement, dashboardTitle, {
          format,
          quality: exportOptions.quality / 100,
          scale: exportOptions.scale,
          ...customOptions,
        });
      } finally {
        // Restore original styles
        elementsToFix.forEach((el: any) => {
          const original = originalStyles.get(el);
          if (original && el.style) {
            el.style.border = original.border;
            el.style.borderRadius = original.borderRadius;
            el.style.boxShadow = original.boxShadow;
            el.style.marginTop = original.marginTop;
            el.style.paddingTop = original.paddingTop;
          }
        });
      }

      toast.success(`Dashboard exported as ${format.toUpperCase()} successfully!`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      toast.error(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  const ExportButton = ({
    format,
    icon: Icon,
    label,
  }: {
    format: ExportFormat;
    icon: any;
    label: string;
  }) => (
    <DropdownMenuItem
      className="cursor-pointer"
      onSelect={() => handleExport(format)}
      disabled={isExporting}
    >
      <Icon className="w-4 h-4 mr-2" />
      {isExporting ? 'Exporting...' : `Export as ${label}`}
    </DropdownMenuItem>
  );

  if (variant === 'button') {
    return (
      <Button onClick={() => handleExport('pdf')} disabled={isExporting} className={className}>
        {isExporting ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Download className="w-4 h-4 mr-2" />
        )}
        {isExporting ? 'Exporting...' : 'Export'}
      </Button>
    );
  }

  if (variant === 'icon') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={isExporting} className={className}>
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <ExportButton format="pdf" icon={FileText} label="PDF" />
          <ExportButton format="jpeg" icon={Image} label="JPEG" />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Default dropdown variant
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting} className={className}>
          {isExporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <ExportButton format="pdf" icon={FileText} label="PDF" />
        <ExportButton format="jpeg" icon={Image} label="JPEG" />

        <DropdownMenuSeparator />

        <Dialog open={showAdvanced} onOpenChange={setShowAdvanced}>
          <DialogTrigger asChild>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={(e) => {
                e.preventDefault();
                setShowAdvanced(true);
              }}
            >
              Advanced Options
            </DropdownMenuItem>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Export Options</DialogTitle>
              <DialogDescription>Customize your dashboard export settings</DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Include Filters Option */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="include-filters">Include Filters</Label>
                  <p className="text-sm text-muted-foreground">
                    Export dashboard with filter panels visible
                  </p>
                </div>
                <Switch
                  id="include-filters"
                  checked={exportOptions.includeFilters}
                  onCheckedChange={(checked) =>
                    setExportOptions((prev) => ({ ...prev, includeFilters: checked }))
                  }
                />
              </div>

              {/* Quality Slider */}
              <div className="space-y-2">
                <Label>Image Quality: {exportOptions.quality}%</Label>
                <Slider
                  value={[exportOptions.quality]}
                  onValueChange={(value) =>
                    setExportOptions((prev) => ({ ...prev, quality: value[0] }))
                  }
                  max={100}
                  min={10}
                  step={10}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Higher quality results in larger file sizes
                </p>
              </div>

              {/* Scale Slider */}
              <div className="space-y-2">
                <Label>Resolution Scale: {exportOptions.scale}x</Label>
                <Slider
                  value={[exportOptions.scale]}
                  onValueChange={(value) =>
                    setExportOptions((prev) => ({ ...prev, scale: value[0] }))
                  }
                  max={4}
                  min={1}
                  step={0.5}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Higher scale provides better resolution for large displays
                </p>
              </div>

              {/* Export Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => {
                    handleExport('pdf');
                    setShowAdvanced(false);
                  }}
                  disabled={isExporting}
                  className="flex-1"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
                <Button
                  onClick={() => {
                    handleExport('jpeg');
                    setShowAdvanced(false);
                  }}
                  disabled={isExporting}
                  variant="outline"
                  className="flex-1"
                >
                  <Image className="w-4 h-4 mr-2" />
                  Export JPEG
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
