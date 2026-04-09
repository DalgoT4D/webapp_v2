'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Save, X, ImageIcon, Palette, Gradient } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface DashboardThemeSettingsProps {
  dashboardId: number;
  currentTheme?: {
    background_color?: string;
    background_gradient?: any;
    background_image_url?: string;
    background_image_blur?: number;
    chart_opacity?: number;
    overlay_color?: string;
    overlay_opacity?: number;
  };
  onSave?: (theme: any) => void;
  onClose?: () => void;
}

export function DashboardThemeSettings({
  dashboardId,
  currentTheme = {},
  onSave,
  onClose,
}: DashboardThemeSettingsProps) {
  const { toast } = useToast();

  const [backgroundColor, setBackgroundColor] = useState(currentTheme.background_color || '');
  const [backgroundGradient, setBackgroundGradient] = useState(
    currentTheme.background_gradient || null
  );
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(
    currentTheme.background_image_url || ''
  );
  const [backgroundImageBlur, setBackgroundImageBlur] = useState(
    currentTheme.background_image_blur || 0
  );
  const [chartOpacity, setChartOpacity] = useState(currentTheme.chart_opacity || 1.0);
  const [overlayColor, setOverlayColor] = useState(currentTheme.overlay_color || '');
  const [overlayOpacity, setOverlayOpacity] = useState(currentTheme.overlay_opacity || 0.0);

  const [isSaving, setIsSaving] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const themeData = {
        theme_background_color: backgroundColor.trim() || null,
        theme_background_gradient: backgroundGradient,
        theme_background_image_url: backgroundImageUrl.trim() || null,
        theme_background_image_blur: backgroundImageBlur,
        theme_chart_opacity: chartOpacity,
        theme_overlay_color: overlayColor.trim() || null,
        theme_overlay_opacity: overlayOpacity,
      };

      // Call the API to update dashboard theme
      const response = await fetch(`/api/dashboards/${dashboardId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(themeData),
      });

      if (!response.ok) {
        throw new Error('Failed to save theme settings');
      }

      toast({
        title: 'Theme saved',
        description: 'Dashboard theme has been updated successfully.',
      });

      onSave?.(themeData);
      onClose?.();
    } catch (error) {
      console.error('Failed to save theme:', error);
      toast({
        title: 'Save failed',
        description: 'Failed to save theme settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    dashboardId,
    backgroundColor,
    backgroundGradient,
    backgroundImageUrl,
    backgroundImageBlur,
    chartOpacity,
    overlayColor,
    overlayOpacity,
    onSave,
    onClose,
    toast,
  ]);

  const handleRemoveBackgroundImage = useCallback(() => {
    setBackgroundImageUrl('');
    setPreviewError(false);
  }, []);

  const handleRemoveOverlay = useCallback(() => {
    setOverlayColor('');
    setOverlayOpacity(0.0);
  }, []);

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Dashboard Theme
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          Customize the appearance of your dashboard with colors, gradients, and background images.
        </p>
      </DialogHeader>
      {/* Background Color */}
      <div className="space-y-2">
        <Label htmlFor="background-color">Background Color</Label>
        <div className="flex gap-2">
          <Input
            id="background-color"
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            className="w-16 h-10 p-1 border rounded"
          />
          <Input
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            placeholder="#ffffff or transparent"
            className="flex-1"
          />
          {backgroundColor && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBackgroundColor('')}
              title="Remove background color"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Solid background color for the dashboard canvas.
        </p>
      </div>

      {/* Background Gradient */}
      <div className="space-y-2">
        <Label>Background Gradient</Label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant={backgroundGradient?.type === 'linear' ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                setBackgroundGradient({
                  type: 'linear',
                  colors: ['#ffffff', '#000000'],
                  direction: 'to bottom',
                })
              }
            >
              <Gradient className="w-4 h-4 mr-2" />
              Linear
            </Button>
            <Button
              variant={backgroundGradient?.type === 'radial' ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                setBackgroundGradient({ type: 'radial', colors: ['#ffffff', '#000000'] })
              }
            >
              <Gradient className="w-4 h-4 mr-2" />
              Radial
            </Button>
            {backgroundGradient && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBackgroundGradient(null)}
                title="Remove gradient"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          {backgroundGradient && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={backgroundGradient.colors?.[0] || '#ffffff'}
                onChange={(e) =>
                  setBackgroundGradient({
                    ...backgroundGradient,
                    colors: [e.target.value, backgroundGradient.colors?.[1] || '#000000'],
                  })
                }
                type="color"
                className="h-10"
              />
              <Input
                value={backgroundGradient.colors?.[1] || '#000000'}
                onChange={(e) =>
                  setBackgroundGradient({
                    ...backgroundGradient,
                    colors: [backgroundGradient.colors?.[0] || '#ffffff', e.target.value],
                  })
                }
                type="color"
                className="h-10"
              />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Gradient background that overrides solid color.
        </p>
      </div>

      {/* Background Image */}
      <div className="space-y-2">
        <Label htmlFor="background-image">Background Image URL</Label>
        <div className="flex gap-2">
          <Input
            id="background-image"
            value={backgroundImageUrl}
            onChange={(e) => {
              setBackgroundImageUrl(e.target.value);
              setPreviewError(false);
            }}
            placeholder="https://example.com/image.jpg"
            className="flex-1"
          />
          {backgroundImageUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveBackgroundImage}
              title="Remove background image"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        {backgroundImageUrl && (
          <div className="space-y-2">
            <Label>Image Blur: {backgroundImageBlur}px</Label>
            <Slider
              value={[backgroundImageBlur]}
              onValueChange={([value]) => setBackgroundImageBlur(value)}
              min={0}
              max={20}
              step={1}
              className="w-full"
            />
            <div className="border rounded-lg p-4 bg-gray-50 flex items-center justify-center">
              {!previewError ? (
                <img
                  src={backgroundImageUrl}
                  alt="Background preview"
                  style={{
                    width: '200px',
                    height: '120px',
                    objectFit: 'cover',
                    filter: `blur(${backgroundImageBlur}px)`,
                    borderRadius: '4px',
                  }}
                  onError={() => setPreviewError(true)}
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <ImageIcon className="w-4 h-4" />
                  <span>Failed to load image. Check the URL.</span>
                </div>
              )}
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Background image that will be blurred and overlaid behind charts.
        </p>
      </div>

      {/* Chart Opacity */}
      <div className="space-y-2">
        <Label>Chart Opacity: {(chartOpacity * 100).toFixed(0)}%</Label>
        <Slider
          value={[chartOpacity]}
          onValueChange={([value]) => setChartOpacity(value)}
          min={0.1}
          max={1.0}
          step={0.1}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Opacity of chart components. Lower values make charts more transparent.
        </p>
      </div>

      {/* Overlay */}
      <div className="space-y-2">
        <Label>Overlay Filter</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={overlayColor}
            onChange={(e) => setOverlayColor(e.target.value)}
            className="w-16 h-10 p-1 border rounded"
          />
          <Input
            value={overlayColor}
            onChange={(e) => setOverlayColor(e.target.value)}
            placeholder="#000000"
            className="flex-1"
          />
          {overlayColor && (
            <Button variant="ghost" size="sm" onClick={handleRemoveOverlay} title="Remove overlay">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        {overlayColor && (
          <div className="space-y-2">
            <Label>Overlay Opacity: {(overlayOpacity * 100).toFixed(0)}%</Label>
            <Slider
              value={[overlayOpacity]}
              onValueChange={([value]) => setOverlayOpacity(value)}
              min={0.0}
              max={1.0}
              step={0.1}
              className="w-full"
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Semi-transparent overlay applied over the entire dashboard.
        </p>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Theme'}
        </Button>
      </div>
    </div>
  );
}
