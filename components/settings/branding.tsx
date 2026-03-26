'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Save, X, ImageIcon, Plus, Trash2, Check, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardBranding, updateDashboardBranding } from '@/hooks/api/useDashboardBranding';

// Logo width constraints
const MIN_LOGO_WIDTH = 40;
const MAX_LOGO_WIDTH = 200;

// Default chart palette (matches current hardcoded ECharts default)
const DEFAULT_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

// Preset palettes users can choose from
const PRESET_PALETTES: { name: string; colors: string[] }[] = [
  {
    name: 'Default',
    colors: DEFAULT_PALETTE,
  },
  {
    name: 'Earth Tones',
    colors: [
      '#8B6914',
      '#2E7D32',
      '#C75B12',
      '#5D4037',
      '#00695C',
      '#BF360C',
      '#827717',
      '#4E342E',
    ],
  },
  {
    name: 'Ocean',
    colors: [
      '#0D47A1',
      '#00838F',
      '#1565C0',
      '#00ACC1',
      '#0277BD',
      '#4DD0E1',
      '#01579B',
      '#26C6DA',
    ],
  },
  {
    name: 'Sunset',
    colors: [
      '#E65100',
      '#F57C00',
      '#FF8F00',
      '#FFB300',
      '#D84315',
      '#FF7043',
      '#E64A19',
      '#FFAB40',
    ],
  },
  {
    name: 'Pastel',
    colors: [
      '#90CAF9',
      '#A5D6A7',
      '#FFCC02',
      '#EF9A9A',
      '#CE93D8',
      '#F48FB1',
      '#80CBC4',
      '#FFAB91',
    ],
  },
  {
    name: 'Vibrant',
    colors: [
      '#D50000',
      '#304FFE',
      '#00C853',
      '#FFAB00',
      '#AA00FF',
      '#00BFA5',
      '#FF6D00',
      '#6200EA',
    ],
  },
  {
    name: 'Monochrome',
    colors: [
      '#212121',
      '#424242',
      '#616161',
      '#757575',
      '#9E9E9E',
      '#BDBDBD',
      '#E0E0E0',
      '#F5F5F5',
    ],
  },
];

// Generate a palette derived from a logo image URL using canvas color extraction
async function extractColorsFromImage(imageUrl: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }

      // Sample at a small size for performance
      const sampleSize = 64;
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

      const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
      const colorMap = new Map<string, number>();

      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const a = imageData[i + 3];

        // Skip transparent and near-white/near-black pixels
        if (a < 128) continue;
        const brightness = (r + g + b) / 3;
        if (brightness > 240 || brightness < 15) continue;

        // Quantize to reduce similar colors
        const qr = Math.round(r / 32) * 32;
        const qg = Math.round(g / 32) * 32;
        const qb = Math.round(b / 32) * 32;
        const hex = `#${qr.toString(16).padStart(2, '0')}${qg.toString(16).padStart(2, '0')}${qb.toString(16).padStart(2, '0')}`;

        colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
      }

      // Sort by frequency and pick top 8 distinct colors
      const sorted = [...colorMap.entries()].sort((a, b) => b[1] - a[1]).map(([color]) => color);

      // Ensure we have at least 8 colors by adding complementary colors
      const result = sorted.slice(0, 8);
      while (result.length < 8) {
        // Fill with adjusted versions of existing colors
        const baseColor = result[result.length % Math.max(1, sorted.length)] || '#3b82f6';
        const r = parseInt(baseColor.slice(1, 3), 16);
        const g = parseInt(baseColor.slice(3, 5), 16);
        const b = parseInt(baseColor.slice(5, 7), 16);
        const shifted = `#${((r + 64) % 256).toString(16).padStart(2, '0')}${((g + 96) % 256).toString(16).padStart(2, '0')}${((b + 48) % 256).toString(16).padStart(2, '0')}`;
        if (!result.includes(shifted)) {
          result.push(shifted);
        } else {
          result.push(DEFAULT_PALETTE[result.length % DEFAULT_PALETTE.length]);
        }
      }

      resolve(result.slice(0, 8));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

function PalettePreview({
  colors,
  isActive,
  onClick,
  label,
}: {
  colors: string[];
  isActive: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col gap-1.5 p-2 rounded-lg border-2 transition-all hover:shadow-sm',
        isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
      )}
      title={label}
      data-testid={`palette-${label.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className="flex gap-0.5">
        {colors.slice(0, 8).map((color, i) => (
          <div
            key={i}
            className="w-5 h-5 rounded-sm flex-shrink-0"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <span className="text-xs text-gray-600 text-left">{label}</span>
      {isActive && <Check className="w-3 h-3 text-blue-500 absolute top-1 right-1" />}
    </button>
  );
}

export default function BrandingSettings() {
  const { branding, isLoading, mutate } = useDashboardBranding();

  const [logoUrl, setLogoUrl] = useState('');
  const [logoWidth, setLogoWidth] = useState(80);
  const [paletteName, setPaletteName] = useState<string | null>(null);
  const [paletteColors, setPaletteColors] = useState<string[]>(DEFAULT_PALETTE);
  const [isSaving, setIsSaving] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [isExtractingColors, setIsExtractingColors] = useState(false);
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync state only on initial load from server
  const hasSynced = useRef(false);
  useEffect(() => {
    if (branding && !hasSynced.current) {
      hasSynced.current = true;
      setLogoUrl(branding.dashboard_logo_url || '');
      setLogoWidth(branding.dashboard_logo_width || 80);
      setPaletteName(branding.chart_palette_name);
      setPaletteColors(branding.chart_palette_colors || DEFAULT_PALETTE);
    }
  }, [branding]);

  const markChanged = useCallback(() => setHasChanges(true), []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateDashboardBranding({
        dashboard_logo_url: logoUrl.trim() || null,
        dashboard_logo_width: logoWidth,
        chart_palette_name: paletteName,
        chart_palette_colors: paletteColors,
      });
      await mutate();
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save branding:', error);
    } finally {
      setIsSaving(false);
    }
  }, [logoUrl, logoWidth, paletteName, paletteColors, mutate]);

  const handleSelectPreset = useCallback(
    (preset: { name: string; colors: string[] }) => {
      setPaletteName(preset.name);
      setPaletteColors([...preset.colors]);
      markChanged();
    },
    [markChanged]
  );

  const handleExtractFromLogo = useCallback(async () => {
    if (!logoUrl) return;
    setIsExtractingColors(true);
    try {
      const colors = await extractColorsFromImage(logoUrl);
      setPaletteName('logo-derived');
      setPaletteColors(colors);
      markChanged();
    } catch (error) {
      console.error('Failed to extract colors from logo:', error);
    } finally {
      setIsExtractingColors(false);
    }
  }, [logoUrl, markChanged]);

  const handleCustomColorChange = useCallback(
    (index: number, color: string) => {
      const newColors = [...paletteColors];
      newColors[index] = color;
      setPaletteColors(newColors);
      setPaletteName('custom');
      markChanged();
    },
    [paletteColors, markChanged]
  );

  const handleRemoveLogo = useCallback(() => {
    setLogoUrl('');
    markChanged();
  }, [markChanged]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 border-b bg-background p-6 pb-4">
          <h1 className="text-3xl font-bold">Branding</h1>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid="branding-settings-page">
      {/* Fixed Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h1 className="text-3xl font-bold">Branding</h1>
            <p className="text-muted-foreground mt-1">
              Customize your organization&apos;s logo and chart color palette
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            variant="ghost"
            className="text-white hover:opacity-90 shadow-xs"
            style={{ backgroundColor: 'var(--primary)' }}
            data-testid="branding-save-btn"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6 mt-6">
        <div className="h-full overflow-y-auto space-y-6 max-w-3xl">
          {/* Logo Section */}
          <Card>
            <CardHeader>
              <CardTitle>Organization Logo</CardTitle>
              <CardDescription>
                Set a logo that appears across the platform — on dashboards, reports, and shared
                views. Provide an image URL (no file upload).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logo-url">Logo URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="logo-url"
                    value={logoUrl}
                    onChange={(e) => {
                      setLogoUrl(e.target.value);
                      setPreviewError(false);
                      markChanged();
                    }}
                    placeholder="https://example.com/logo.png"
                    className="flex-1"
                    data-testid="branding-logo-url-input"
                  />
                  {logoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                      title="Remove logo"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {logoUrl && (
                <>
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

                  <div className="space-y-2">
                    <Label>Logo Width: {logoWidth}px</Label>
                    <Slider
                      value={[logoWidth]}
                      onValueChange={([value]) => {
                        setLogoWidth(value);
                        markChanged();
                      }}
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
                </>
              )}
            </CardContent>
          </Card>

          {/* Chart Color Palette Section */}
          <Card>
            <CardHeader>
              <CardTitle>Chart Color Palette</CardTitle>
              <CardDescription>
                Choose a color palette applied to all charts on your dashboards. Pick a preset,
                generate from your logo, or customize individual colors.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preset Palettes */}
              <div className="space-y-2">
                <Label>Preset Palettes</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRESET_PALETTES.map((preset) => (
                    <PalettePreview
                      key={preset.name}
                      colors={preset.colors}
                      isActive={paletteName === preset.name}
                      onClick={() => handleSelectPreset(preset)}
                      label={preset.name}
                    />
                  ))}
                </div>
              </div>

              {/* Generate from Logo */}
              {logoUrl && (
                <div className="space-y-2">
                  <Label>Generate from Logo</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExtractFromLogo}
                    disabled={isExtractingColors}
                    data-testid="branding-extract-colors-btn"
                  >
                    <Palette className="w-4 h-4 mr-2" />
                    {isExtractingColors ? 'Extracting...' : 'Generate Palette from Logo'}
                  </Button>
                  {paletteName === 'logo-derived' && (
                    <p className="text-xs text-muted-foreground">
                      Palette generated from your logo colors. You can fine-tune individual colors
                      below.
                    </p>
                  )}
                </div>
              )}

              {/* Active Palette Editor */}
              <div className="space-y-2">
                <Label>
                  Active Palette
                  {paletteName && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      ({paletteName})
                    </span>
                  )}
                </Label>
                <div className="flex gap-2 flex-wrap">
                  {paletteColors.map((color, index) => (
                    <div key={index} className="relative">
                      <button
                        className={cn(
                          'w-10 h-10 rounded-lg border-2 transition-all hover:scale-110',
                          editingColorIndex === index
                            ? 'border-blue-500 ring-2 ring-blue-200'
                            : 'border-gray-200'
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() =>
                          setEditingColorIndex(editingColorIndex === index ? null : index)
                        }
                        title={`Color ${index + 1}: ${color}`}
                        data-testid={`palette-color-${index}`}
                      />
                      <span className="text-[9px] text-gray-400 block text-center mt-0.5">
                        {index + 1}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Inline color editor */}
                {editingColorIndex !== null && (
                  <div
                    className="mt-3 p-3 border rounded-lg bg-gray-50 max-w-[240px]"
                    data-testid="palette-color-editor"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs">Color {editingColorIndex + 1}</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => setEditingColorIndex(null)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <HexColorPicker
                      color={paletteColors[editingColorIndex]}
                      onChange={(newColor) => handleCustomColorChange(editingColorIndex, newColor)}
                      style={{ width: '100%', height: '140px' }}
                    />
                    <Input
                      value={paletteColors[editingColorIndex]}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                          handleCustomColorChange(editingColorIndex, val);
                        }
                      }}
                      className="mt-2 text-xs h-7"
                      placeholder="#000000"
                    />
                  </div>
                )}
              </div>

              {/* Preview bar chart colors */}
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="border rounded-lg p-4 bg-white flex items-end gap-1.5 h-24">
                  {paletteColors.map((color, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t"
                      style={{
                        backgroundColor: color,
                        height: `${30 + ((i * 17 + 23) % 70)}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
