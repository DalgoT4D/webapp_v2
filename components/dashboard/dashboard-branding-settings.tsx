'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, X, ImageIcon } from 'lucide-react';
import { useDashboardBranding, updateDashboardBranding } from '@/hooks/api/useDashboardBranding';

// Logo width constraints in pixels
const MIN_LOGO_WIDTH = 40;
const MAX_LOGO_WIDTH = 200;

interface DashboardBrandingSettingsProps {
  onClose?: () => void;
}

export function DashboardBrandingSettings({ onClose }: DashboardBrandingSettingsProps) {
  const { branding, isLoading, mutate } = useDashboardBranding();

  const [logoUrl, setLogoUrl] = useState(branding?.dashboard_logo_url || '');
  const [logoWidth, setLogoWidth] = useState(branding?.dashboard_logo_width || 80);
  const [isSaving, setIsSaving] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  // Sync state when branding loads
  const [hasInitialized, setHasInitialized] = useState(false);
  if (branding && !hasInitialized) {
    setLogoUrl(branding.dashboard_logo_url || '');
    setLogoWidth(branding.dashboard_logo_width || 80);
    setHasInitialized(true);
  }

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateDashboardBranding({
        dashboard_logo_url: logoUrl.trim() || null,
        dashboard_logo_width: logoWidth,
      });
      await mutate();
      onClose?.();
    } catch (error) {
      console.error('Failed to save branding:', error);
    } finally {
      setIsSaving(false);
    }
  }, [logoUrl, logoWidth, mutate, onClose]);

  const handleRemoveLogo = useCallback(async () => {
    setLogoUrl('');
    setIsSaving(true);
    try {
      await updateDashboardBranding({
        dashboard_logo_url: null,
      });
      await mutate();
    } catch (error) {
      console.error('Failed to remove logo:', error);
    } finally {
      setIsSaving(false);
    }
  }, [mutate]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded w-1/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Dashboard Branding</CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Set a logo that appears on all native dashboards across your organization.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo URL Input */}
        <div className="space-y-2">
          <Label htmlFor="logo-url">Logo URL</Label>
          <div className="flex gap-2">
            <Input
              id="logo-url"
              value={logoUrl}
              onChange={(e) => {
                setLogoUrl(e.target.value);
                setPreviewError(false);
              }}
              placeholder="https://example.com/logo.png"
              className="flex-1"
              data-testid="branding-logo-url-input"
            />
            {logoUrl && (
              <Button variant="ghost" size="sm" onClick={handleRemoveLogo} title="Remove logo">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Logo Preview */}
        {logoUrl && (
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="border rounded-lg p-4 bg-gray-50 flex items-center">
              {!previewError ? (
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  style={{ width: `${logoWidth}px`, height: 'auto' }}
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

        {/* Logo Size Slider */}
        {logoUrl && (
          <div className="space-y-2">
            <Label>Logo Width: {logoWidth}px</Label>
            <Slider
              value={[logoWidth]}
              onValueChange={([value]) => setLogoWidth(value)}
              min={MIN_LOGO_WIDTH}
              max={MAX_LOGO_WIDTH}
              step={5}
              className="w-full"
              data-testid="branding-logo-width-slider"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{MIN_LOGO_WIDTH}px</span>
              <span>{MAX_LOGO_WIDTH}px</span>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} data-testid="branding-save-btn">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Branding'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
