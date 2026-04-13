'use client';

import { useMemo, useState } from 'react';
import { HexAlphaColorPicker, HexColorInput, HexColorPicker } from 'react-colorful';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Save, X, ImageIcon, Palette, Blend, SlidersHorizontal } from 'lucide-react';
import {
  buildDashboardBackgroundImageStyle,
  buildDashboardOverlayStyle,
  buildDashboardSurfaceStyle,
  DASHBOARD_THEME_LINEAR_DIRECTIONS,
  normalizeDashboardTheme,
  type DashboardThemeConfig,
  type DashboardThemeGradient,
} from '@/lib/dashboard-theme';

interface DashboardThemeSettingsProps {
  currentTheme?: Partial<DashboardThemeConfig>;
  onSave: (theme: DashboardThemeConfig) => Promise<boolean> | boolean;
  onClose?: () => void;
}

const SOLID_PRESETS = [
  '#ffffffff',
  '#f8fafcff',
  '#eff6ffff',
  '#ecfeffff',
  '#faf5ffff',
  '#fff7edff',
  '#111827f2',
  '#0f172ae6',
] as const;

const OVERLAY_PRESETS = ['#0f172a', '#111827', '#1e293b', '#134e4a', '#7f1d1d', '#4c1d95'] as const;

const GRADIENT_PRESETS: { label: string; gradient: DashboardThemeGradient }[] = [
  {
    label: 'Sky',
    gradient: {
      type: 'linear',
      direction: '135deg',
      colors: ['#e0f2feff', '#dbeafeff'],
    },
  },
  {
    label: 'Aurora',
    gradient: {
      type: 'linear',
      direction: '135deg',
      colors: ['#dcfce7ff', '#cffafeff'],
    },
  },
  {
    label: 'Sunset',
    gradient: {
      type: 'linear',
      direction: '135deg',
      colors: ['#fff1f2ff', '#ffedd5ff'],
    },
  },
  {
    label: 'Spotlight',
    gradient: {
      type: 'radial',
      colors: ['#ffffffff', '#cbd5e1ff'],
    },
  },
];

const HEX_WITH_ALPHA = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const HEX_OPAQUE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function toPickerColor(value: string | null | undefined, fallback: string, allowAlpha: boolean) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  if (trimmed === 'transparent' && allowAlpha) {
    return '#00000000';
  }

  if (allowAlpha ? HEX_WITH_ALPHA.test(trimmed) : HEX_OPAQUE.test(trimmed)) {
    return trimmed;
  }

  return fallback;
}

interface ColorEditorProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  fallback: string;
  presets: readonly string[];
  allowAlpha?: boolean;
}

function ColorEditor({
  label,
  description,
  value,
  onChange,
  fallback,
  presets,
  allowAlpha = true,
}: ColorEditorProps) {
  const pickerValue = useMemo(
    () => toPickerColor(value, fallback, allowAlpha),
    [allowAlpha, fallback, value]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label>{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex min-w-[150px] items-center gap-2 rounded-md border bg-background px-3 py-2">
          <div
            className="h-5 w-5 rounded-md border border-slate-300"
            style={{ backgroundColor: pickerValue }}
          />
          <HexColorInput
            alpha={allowAlpha}
            color={pickerValue}
            onChange={onChange}
            prefixed
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-label={`Set color ${preset}`}
            className={`h-9 rounded-md border transition ${
              pickerValue === preset
                ? 'border-slate-900 ring-2 ring-slate-300'
                : 'border-slate-200 hover:border-slate-400'
            }`}
            style={{ backgroundColor: preset }}
            onClick={() => onChange(preset)}
          />
        ))}
      </div>

      {allowAlpha ? (
        <HexAlphaColorPicker color={pickerValue} onChange={onChange} style={{ width: '100%' }} />
      ) : (
        <HexColorPicker color={pickerValue} onChange={onChange} style={{ width: '100%' }} />
      )}
    </div>
  );
}

export function DashboardThemeSettings({
  currentTheme,
  onSave,
  onClose,
}: DashboardThemeSettingsProps) {
  const initialTheme = normalizeDashboardTheme(currentTheme);
  const [fillMode, setFillMode] = useState<'solid' | 'gradient'>(
    initialTheme.theme_background_gradient ? 'gradient' : 'solid'
  );
  const [backgroundColor, setBackgroundColor] = useState(
    toPickerColor(initialTheme.theme_background_color, '#ffffffff', true)
  );
  const [backgroundGradient, setBackgroundGradient] = useState<DashboardThemeGradient>(
    initialTheme.theme_background_gradient || {
      type: 'linear',
      direction: '180deg',
      colors: ['#ffffffff', '#dbeafeff'],
    }
  );
  const [activeGradientStop, setActiveGradientStop] = useState<0 | 1>(0);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(
    initialTheme.theme_background_image_url || ''
  );
  const [backgroundImageBlur, setBackgroundImageBlur] = useState(
    initialTheme.theme_background_image_blur
  );
  const [overlayEnabled, setOverlayEnabled] = useState(
    Boolean(initialTheme.theme_overlay_color && initialTheme.theme_overlay_opacity > 0)
  );
  const [overlayColor, setOverlayColor] = useState(
    toPickerColor(initialTheme.theme_overlay_color, '#0f172a', false)
  );
  const [overlayOpacity, setOverlayOpacity] = useState(initialTheme.theme_overlay_opacity || 0.35);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const draftTheme = useMemo(
    () =>
      normalizeDashboardTheme({
        theme_background_color: fillMode === 'solid' ? backgroundColor : null,
        theme_background_gradient: fillMode === 'gradient' ? backgroundGradient : null,
        theme_background_image_url: backgroundImageUrl.trim() || null,
        theme_background_image_blur: backgroundImageBlur,
        theme_chart_opacity: initialTheme.theme_chart_opacity,
        theme_overlay_color: overlayEnabled ? overlayColor : null,
        theme_overlay_opacity: overlayEnabled ? overlayOpacity : 0,
      }),
    [
      backgroundColor,
      backgroundGradient,
      backgroundImageBlur,
      backgroundImageUrl,
      fillMode,
      initialTheme.theme_chart_opacity,
      overlayColor,
      overlayEnabled,
      overlayOpacity,
    ]
  );

  const surfacePreviewStyle = useMemo(() => buildDashboardSurfaceStyle(draftTheme), [draftTheme]);
  const backgroundImageStyle = useMemo(
    () => buildDashboardBackgroundImageStyle(draftTheme),
    [draftTheme]
  );
  const overlayStyle = useMemo(() => buildDashboardOverlayStyle(draftTheme), [draftTheme]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const didSave = await onSave(draftTheme);
      if (didSave === false) {
        setSaveError('Failed to save dashboard background. Please try again.');
        return;
      }
      onClose?.();
    } catch (error) {
      console.error('Failed to save dashboard background:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save dashboard background.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Palette className="w-5 h-5" />
          Dashboard Background
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          Set a per-dashboard background with solid colors, transparency, gradients, and optional
          image styling.
        </p>
      </DialogHeader>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1">
            <Label>Preview</Label>
            <p className="text-xs text-muted-foreground">
              This reflects how the dashboard canvas will look behind charts and text blocks. Chart
              cards stay white by default unless you change a panel background explicitly.
            </p>
          </div>

          <div
            className="relative overflow-hidden rounded-xl border border-slate-200 bg-white"
            style={surfacePreviewStyle}
          >
            {backgroundImageStyle && <div aria-hidden="true" style={backgroundImageStyle} />}
            {overlayStyle && <div aria-hidden="true" style={overlayStyle} />}

            <div className="relative z-10 grid gap-3 p-4 md:grid-cols-[1.4fr_1fr]">
              <div className="rounded-lg border border-white/50 bg-white p-4 shadow-sm backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Primary Card</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">42.7%</p>
                <p className="mt-2 text-sm text-slate-600">
                  Example chart and KPI cards keep their content readable over the background.
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border border-white/50 bg-white p-4 shadow-sm backdrop-blur-sm">
                  <p className="text-sm font-medium text-slate-900">Secondary Panel</p>
                  <div className="mt-3 flex gap-2">
                    <div className="h-14 flex-1 rounded-md bg-slate-900/10" />
                    <div className="h-14 w-16 rounded-md bg-slate-900/20" />
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-white/50 bg-white/50 p-4 text-sm text-slate-600 backdrop-blur-sm">
                  Filters, notes, and text elements remain above the themed background.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="space-y-1">
            <Label>Fill Mode</Label>
            <p className="text-xs text-muted-foreground">
              Solid colors support transparency. Gradients can blend two independent colors.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={fillMode === 'solid' ? 'default' : 'outline'}
              onClick={() => setFillMode('solid')}
            >
              <Palette className="mr-2 h-4 w-4" />
              Solid
            </Button>
            <Button
              type="button"
              variant={fillMode === 'gradient' ? 'default' : 'outline'}
              onClick={() => setFillMode('gradient')}
            >
              <Blend className="mr-2 h-4 w-4" />
              Gradient
            </Button>
          </div>

          {fillMode === 'solid' ? (
            <ColorEditor
              label="Background Color"
              description="Pick the base color for this dashboard. Alpha lets you create soft translucent backgrounds."
              value={backgroundColor}
              onChange={setBackgroundColor}
              fallback="#ffffffff"
              presets={SOLID_PRESETS}
            />
          ) : (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Quick Gradients</Label>
                  <p className="text-xs text-muted-foreground">
                    Start from a preset, then fine-tune each stop below.
                  </p>
                </div>

                <div className="grid gap-2 md:grid-cols-4">
                  {GRADIENT_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className="overflow-hidden rounded-lg border border-slate-200 text-left transition hover:border-slate-400"
                      onClick={() => {
                        setFillMode('gradient');
                        setBackgroundGradient(preset.gradient);
                      }}
                    >
                      <div
                        className="h-14"
                        style={{
                          background:
                            preset.gradient.type === 'radial'
                              ? `radial-gradient(circle at center, ${preset.gradient.colors[0]}, ${preset.gradient.colors[1]})`
                              : `linear-gradient(${preset.gradient.direction}, ${preset.gradient.colors[0]}, ${preset.gradient.colors[1]})`,
                        }}
                      />
                      <div className="px-3 py-2 text-sm font-medium text-slate-700">
                        {preset.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={backgroundGradient.type === 'linear' ? 'default' : 'outline'}
                  onClick={() =>
                    setBackgroundGradient((currentGradient) => ({
                      ...currentGradient,
                      type: 'linear',
                      direction: currentGradient.direction || '180deg',
                    }))
                  }
                >
                  <Blend className="mr-2 h-4 w-4" />
                  Linear
                </Button>
                <Button
                  type="button"
                  variant={backgroundGradient.type === 'radial' ? 'default' : 'outline'}
                  onClick={() =>
                    setBackgroundGradient((currentGradient) => ({
                      ...currentGradient,
                      type: 'radial',
                      direction: null,
                    }))
                  }
                >
                  <Blend className="mr-2 h-4 w-4" />
                  Radial
                </Button>
              </div>

              {backgroundGradient.type === 'linear' && (
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <div className="flex flex-wrap gap-2">
                    {DASHBOARD_THEME_LINEAR_DIRECTIONS.map((direction) => (
                      <Button
                        key={direction.value}
                        type="button"
                        variant={
                          backgroundGradient.direction === direction.value ? 'default' : 'outline'
                        }
                        size="sm"
                        onClick={() =>
                          setBackgroundGradient((currentGradient) => ({
                            ...currentGradient,
                            direction: direction.value,
                          }))
                        }
                      >
                        {direction.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {(['Start Color', 'End Color'] as const).map((label, index) => (
                  <Button
                    key={label}
                    type="button"
                    variant={activeGradientStop === index ? 'default' : 'outline'}
                    onClick={() => setActiveGradientStop(index as 0 | 1)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              <ColorEditor
                label={activeGradientStop === 0 ? 'Start Color' : 'End Color'}
                description="Both gradient stops support transparency, so you can create soft, layered canvases."
                value={backgroundGradient.colors[activeGradientStop]}
                onChange={(nextColor) =>
                  setBackgroundGradient((currentGradient) => ({
                    ...currentGradient,
                    colors:
                      activeGradientStop === 0
                        ? [nextColor, currentGradient.colors[1]]
                        : [currentGradient.colors[0], nextColor],
                  }))
                }
                fallback={activeGradientStop === 0 ? '#ffffffff' : '#dbeafeff'}
                presets={SOLID_PRESETS}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="flex items-center gap-2 text-slate-900">
            <ImageIcon className="h-4 w-4" />
            <Label htmlFor="background-image">Background Image</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Optional. This stays behind the grid and works with the color or gradient you choose.
          </p>

          <div className="flex gap-2">
            <Input
              id="background-image"
              value={backgroundImageUrl}
              onChange={(event) => setBackgroundImageUrl(event.target.value)}
              placeholder="https://example.com/background.jpg"
              className="flex-1"
            />
            {backgroundImageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBackgroundImageUrl('')}
                title="Remove background image"
              >
                <X className="h-4 w-4" />
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
                max={24}
                step={1}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="flex items-center gap-2 text-slate-900">
            <SlidersHorizontal className="h-4 w-4" />
            <Label>Overlay</Label>
          </div>

          <div className="space-y-4 rounded-xl border border-dashed border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <Label>Overlay Tint</Label>
                <p className="text-xs text-muted-foreground">
                  Add a subtle tint over the background when you need more contrast.
                </p>
              </div>

              <Button
                type="button"
                variant={overlayEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => setOverlayEnabled((currentValue) => !currentValue)}
              >
                {overlayEnabled ? 'Overlay On' : 'Overlay Off'}
              </Button>
            </div>

            {overlayEnabled && (
              <div className="space-y-5">
                <ColorEditor
                  label="Overlay Color"
                  description="A readable tint that sits above the image or fill, but below charts."
                  value={overlayColor}
                  onChange={setOverlayColor}
                  fallback="#0f172a"
                  presets={OVERLAY_PRESETS}
                  allowAlpha={false}
                />

                <div className="space-y-2">
                  <Label>Overlay Opacity: {(overlayOpacity * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[overlayOpacity]}
                    onValueChange={([value]) => setOverlayOpacity(value)}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      <div className="flex justify-end gap-2 border-t pt-4">
        {onClose && (
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Background'}
        </Button>
      </div>
    </div>
  );
}
