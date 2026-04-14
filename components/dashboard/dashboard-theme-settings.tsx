'use client';

import { useMemo, useState } from 'react';
import { HexAlphaColorPicker, HexColorInput, HexColorPicker } from 'react-colorful';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Save, X, ImageIcon, PaintBucket, Blend } from 'lucide-react';
import {
  buildDashboardBackgroundImageStyle,
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

function toTestIdToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
  inputId: string;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  fallback: string;
  presets: readonly string[];
  testIdPrefix: string;
  allowAlpha?: boolean;
}

function ColorEditor({
  inputId,
  label,
  description,
  value,
  onChange,
  fallback,
  presets,
  testIdPrefix,
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
          <Label htmlFor={inputId}>{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex min-w-[150px] items-center gap-2 rounded-md border bg-background px-3 py-2">
          <div
            className="h-5 w-5 rounded-md border border-slate-300"
            style={{ backgroundColor: pickerValue }}
          />
          <HexColorInput
            id={inputId}
            alpha={allowAlpha}
            color={pickerValue}
            onChange={onChange}
            prefixed
            className="w-full bg-transparent text-sm outline-none"
            data-testid={`${testIdPrefix}-input`}
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
            data-testid={`${testIdPrefix}-preset-${toTestIdToken(preset)}`}
          />
        ))}
      </div>

      {allowAlpha ? (
        <HexAlphaColorPicker
          color={pickerValue}
          onChange={onChange}
          style={{ width: '100%' }}
          data-testid={`${testIdPrefix}-alpha-picker`}
        />
      ) : (
        <HexColorPicker
          color={pickerValue}
          onChange={onChange}
          style={{ width: '100%' }}
          data-testid={`${testIdPrefix}-color-picker`}
        />
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
        theme_overlay_color: null,
        theme_overlay_opacity: 0,
      }),
    [
      backgroundColor,
      backgroundGradient,
      backgroundImageBlur,
      backgroundImageUrl,
      fillMode,
      initialTheme.theme_chart_opacity,
    ]
  );

  const surfacePreviewStyle = useMemo(() => buildDashboardSurfaceStyle(draftTheme), [draftTheme]);
  const backgroundImageStyle = useMemo(
    () => buildDashboardBackgroundImageStyle(draftTheme),
    [draftTheme]
  );

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
          <PaintBucket className="w-5 h-5" />
          Dashboard Background
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          Set the dashboard background and preview how chart surfaces sit on top of it.
        </p>
      </DialogHeader>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="space-y-1">
            <Label>Preview</Label>
            <p className="text-xs text-muted-foreground">
              A compact preview of the canvas background behind a default chart card.
            </p>
          </div>

          <div
            className="relative mx-auto max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white"
            style={surfacePreviewStyle}
            data-testid="dashboard-background-preview"
          >
            {backgroundImageStyle && <div aria-hidden="true" style={backgroundImageStyle} />}

            <div className="relative z-10 p-4">
              <div className="mx-auto max-w-sm rounded-lg border border-white/60 bg-white p-4 shadow-sm backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Chart Surface</p>
                <div className="mt-4 flex h-20 items-end gap-2">
                  {[30, 50, 44, 66, 38, 58].map((height, index) => (
                    <div
                      key={height}
                      className={`flex-1 rounded-t-md ${index % 2 === 0 ? 'bg-slate-800/80' : 'bg-slate-400/70'}`}
                      style={{ height }}
                    />
                  ))}
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  The background stays behind the chart while the chart surface remains readable.
                </p>
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
              data-testid="dashboard-background-fill-solid-btn"
            >
              <PaintBucket className="mr-2 h-4 w-4" />
              Solid
            </Button>
            <Button
              type="button"
              variant={fillMode === 'gradient' ? 'default' : 'outline'}
              onClick={() => setFillMode('gradient')}
              data-testid="dashboard-background-fill-gradient-btn"
            >
              <Blend className="mr-2 h-4 w-4" />
              Gradient
            </Button>
          </div>

          {fillMode === 'solid' ? (
            <ColorEditor
              inputId="dashboard-background-color-input"
              label="Background Color"
              description="Pick the base color for this dashboard. Alpha lets you create soft translucent backgrounds."
              value={backgroundColor}
              onChange={setBackgroundColor}
              fallback="#ffffffff"
              presets={SOLID_PRESETS}
              testIdPrefix="dashboard-background-color"
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
                      data-testid={`dashboard-background-gradient-preset-${toTestIdToken(preset.label)}-btn`}
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
                  data-testid="dashboard-background-gradient-linear-btn"
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
                  data-testid="dashboard-background-gradient-radial-btn"
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
                        data-testid={`dashboard-background-direction-${toTestIdToken(direction.label)}-btn`}
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
                    data-testid={`dashboard-background-gradient-stop-${index === 0 ? 'start' : 'end'}-btn`}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              <ColorEditor
                inputId={
                  activeGradientStop === 0
                    ? 'dashboard-background-gradient-start-input'
                    : 'dashboard-background-gradient-end-input'
                }
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
                testIdPrefix={
                  activeGradientStop === 0
                    ? 'dashboard-background-gradient-start'
                    : 'dashboard-background-gradient-end'
                }
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
              data-testid="dashboard-background-image-input"
            />
            {backgroundImageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBackgroundImageUrl('')}
                title="Remove background image"
                data-testid="dashboard-background-image-remove-btn"
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
                data-testid="dashboard-background-image-blur-slider"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      <div className="flex justify-end gap-2 border-t pt-4">
        {onClose && (
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-testid="dashboard-background-cancel-btn"
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          data-testid="dashboard-background-save-btn"
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Background'}
        </Button>
      </div>
    </div>
  );
}
