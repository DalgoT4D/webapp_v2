import type { CSSProperties } from 'react';

export type DashboardThemeGradientType = 'linear' | 'radial';

export interface DashboardThemeGradient {
  type: DashboardThemeGradientType;
  colors: [string, string];
  direction?: string | null;
}

export interface DashboardThemeConfig {
  theme_background_color: string | null;
  theme_background_gradient: DashboardThemeGradient | null;
  theme_background_image_url: string | null;
  theme_background_image_blur: number;
  theme_chart_opacity: number;
  theme_overlay_color: string | null;
  theme_overlay_opacity: number;
}

export const DASHBOARD_THEME_KEYS = [
  'theme_background_color',
  'theme_background_gradient',
  'theme_background_image_url',
  'theme_background_image_blur',
  'theme_chart_opacity',
  'theme_overlay_color',
  'theme_overlay_opacity',
] as const;

export const DEFAULT_DASHBOARD_THEME: DashboardThemeConfig = {
  theme_background_color: null,
  theme_background_gradient: null,
  theme_background_image_url: null,
  theme_background_image_blur: 0,
  theme_chart_opacity: 1,
  theme_overlay_color: null,
  theme_overlay_opacity: 0,
};

export const DASHBOARD_THEME_LINEAR_DIRECTIONS = [
  { value: '180deg', label: 'Top to bottom' },
  { value: '90deg', label: 'Left to right' },
  { value: '135deg', label: 'Diagonal' },
  { value: '45deg', label: 'Reverse diagonal' },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hasOwnProperty<T extends object, K extends PropertyKey>(
  value: T,
  key: K
): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeColor(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeGradient(
  gradient: Partial<DashboardThemeGradient> | null | undefined
): DashboardThemeGradient | null {
  if (!gradient || !Array.isArray(gradient.colors) || gradient.colors.length < 2) {
    return null;
  }

  return {
    type: gradient.type === 'radial' ? 'radial' : 'linear',
    colors: [
      normalizeColor(gradient.colors[0]) || '#ffffffff',
      normalizeColor(gradient.colors[1]) || '#dbeafeff',
    ],
    direction: gradient.type === 'radial' ? null : normalizeColor(gradient.direction) || '180deg',
  };
}

function isUniformGradient(gradient: DashboardThemeGradient | null) {
  if (!gradient) {
    return false;
  }

  return gradient.colors[0].toLowerCase() === gradient.colors[1].toLowerCase();
}

export function normalizeDashboardTheme(
  theme: Partial<DashboardThemeConfig> | null | undefined
): DashboardThemeConfig {
  const normalizedBackgroundColor = normalizeColor(theme?.theme_background_color);
  const normalizedGradient = normalizeGradient(theme?.theme_background_gradient);
  const useGradientAsSolid = !normalizedBackgroundColor && isUniformGradient(normalizedGradient);

  return {
    theme_background_color: useGradientAsSolid
      ? normalizedGradient?.colors[0] || null
      : normalizedBackgroundColor,
    theme_background_gradient: useGradientAsSolid ? null : normalizedGradient,
    theme_background_image_url: normalizeColor(theme?.theme_background_image_url),
    theme_background_image_blur: clamp(
      typeof theme?.theme_background_image_blur === 'number'
        ? theme.theme_background_image_blur
        : DEFAULT_DASHBOARD_THEME.theme_background_image_blur,
      0,
      24
    ),
    theme_chart_opacity: clamp(
      typeof theme?.theme_chart_opacity === 'number'
        ? theme.theme_chart_opacity
        : DEFAULT_DASHBOARD_THEME.theme_chart_opacity,
      0.1,
      1
    ),
    theme_overlay_color: normalizeColor(theme?.theme_overlay_color),
    theme_overlay_opacity: clamp(
      typeof theme?.theme_overlay_opacity === 'number'
        ? theme.theme_overlay_opacity
        : DEFAULT_DASHBOARD_THEME.theme_overlay_opacity,
      0,
      1
    ),
  };
}

export function mergeDashboardTheme(
  baseTheme: Partial<DashboardThemeConfig> | null | undefined,
  overrides: Partial<DashboardThemeConfig> | null | undefined
): DashboardThemeConfig {
  const mergedTheme = { ...normalizeDashboardTheme(baseTheme) };

  if (!overrides) {
    return mergedTheme;
  }

  for (const key of DASHBOARD_THEME_KEYS) {
    if (hasOwnProperty(overrides, key)) {
      (mergedTheme as Record<string, unknown>)[key] = overrides[key];
    }
  }

  return normalizeDashboardTheme(mergedTheme);
}

export function splitDashboardThemeFields(payload: Record<string, unknown> | null | undefined) {
  const themeOverrides: Partial<DashboardThemeConfig> = {};
  const otherFields: Record<string, unknown> = {};

  if (!payload) {
    return { themeOverrides, otherFields };
  }

  for (const [key, value] of Object.entries(payload)) {
    if ((DASHBOARD_THEME_KEYS as readonly string[]).includes(key)) {
      (themeOverrides as Record<string, unknown>)[key] = value;
    } else {
      otherFields[key] = value;
    }
  }

  return { themeOverrides, otherFields };
}

function serializeDashboardColor(value: string | null) {
  if (!value) {
    return '';
  }

  const opaqueHexMatch = /^#([0-9a-f]{6})ff$/i.exec(value);
  return opaqueHexMatch ? `#${opaqueHexMatch[1]}` : value;
}

export function serializeDashboardThemeForApi(
  theme: Partial<DashboardThemeConfig> | null | undefined
) {
  const normalizedTheme = normalizeDashboardTheme(theme);
  const serializedBackgroundColor = serializeDashboardColor(normalizedTheme.theme_background_color);
  const shouldEncodeSolidAsGradient =
    !normalizedTheme.theme_background_gradient &&
    /^#[0-9a-f]{8}$/i.test(serializedBackgroundColor) &&
    !/ff$/i.test(serializedBackgroundColor);

  return {
    theme_background_color: shouldEncodeSolidAsGradient ? '' : serializedBackgroundColor,
    theme_background_gradient:
      normalizedTheme.theme_background_gradient ||
      (shouldEncodeSolidAsGradient
        ? {
            type: 'linear',
            direction: '180deg',
            colors: [serializedBackgroundColor, serializedBackgroundColor],
          }
        : {}),
    theme_background_image_url: normalizedTheme.theme_background_image_url || '',
    theme_background_image_blur: normalizedTheme.theme_background_image_blur,
    theme_chart_opacity: normalizedTheme.theme_chart_opacity,
    theme_overlay_color: serializeDashboardColor(normalizedTheme.theme_overlay_color),
    theme_overlay_opacity: normalizedTheme.theme_overlay_opacity,
  };
}

export function buildDashboardGradientCss(gradient: DashboardThemeGradient) {
  return gradient.type === 'radial'
    ? `radial-gradient(circle at center, ${gradient.colors[0]}, ${gradient.colors[1]})`
    : `linear-gradient(${gradient.direction || '180deg'}, ${gradient.colors[0]}, ${gradient.colors[1]})`;
}

export function buildDashboardSurfaceStyle(
  theme: Partial<DashboardThemeConfig> | null | undefined
): CSSProperties {
  const normalizedTheme = normalizeDashboardTheme(theme);
  const styles: CSSProperties = {};

  if (normalizedTheme.theme_background_color) {
    styles.backgroundColor = normalizedTheme.theme_background_color;
  }

  if (normalizedTheme.theme_background_gradient) {
    styles.background = buildDashboardGradientCss(normalizedTheme.theme_background_gradient);
  }

  return styles;
}

export function buildDashboardBackgroundImageStyle(
  theme: Partial<DashboardThemeConfig> | null | undefined
): CSSProperties | null {
  const normalizedTheme = normalizeDashboardTheme(theme);

  if (!normalizedTheme.theme_background_image_url) {
    return null;
  }

  const blur = normalizedTheme.theme_background_image_blur;
  const expand = blur > 0 ? blur * 2 : 0;

  return {
    position: 'absolute',
    top: -expand,
    right: -expand,
    bottom: -expand,
    left: -expand,
    backgroundImage: `url("${normalizedTheme.theme_background_image_url}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    filter: blur > 0 ? `blur(${blur}px)` : undefined,
    transform: blur > 0 ? 'scale(1.03)' : undefined,
    pointerEvents: 'none',
    zIndex: 1,
  };
}

export function buildDashboardOverlayStyle(
  theme: Partial<DashboardThemeConfig> | null | undefined
): CSSProperties | null {
  const normalizedTheme = normalizeDashboardTheme(theme);

  if (!normalizedTheme.theme_overlay_color || normalizedTheme.theme_overlay_opacity <= 0) {
    return null;
  }

  return {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: normalizedTheme.theme_overlay_color,
    opacity: normalizedTheme.theme_overlay_opacity,
    pointerEvents: 'none',
    zIndex: 2,
  };
}
