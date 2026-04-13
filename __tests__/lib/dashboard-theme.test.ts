import {
  buildDashboardBackgroundImageStyle,
  buildDashboardGradientCss,
  buildDashboardOverlayStyle,
  buildDashboardSurfaceStyle,
  normalizeDashboardTheme,
  serializeDashboardThemeForApi,
} from '@/lib/dashboard-theme';

describe('dashboard theme helpers', () => {
  it('returns stable defaults for empty theme input', () => {
    expect(normalizeDashboardTheme(undefined)).toEqual({
      theme_background_color: null,
      theme_background_gradient: null,
      theme_background_image_url: null,
      theme_background_image_blur: 0,
      theme_chart_opacity: 1,
      theme_overlay_color: null,
      theme_overlay_opacity: 0,
    });
  });

  it('builds gradient css for both linear and radial fills', () => {
    expect(
      buildDashboardGradientCss({
        type: 'linear',
        direction: '90deg',
        colors: ['#ffffff', '#dbeafe'],
      })
    ).toBe('linear-gradient(90deg, #ffffff, #dbeafe)');

    expect(
      buildDashboardGradientCss({
        type: 'radial',
        colors: ['#ffffff', '#cbd5e1'],
      })
    ).toBe('radial-gradient(circle at center, #ffffff, #cbd5e1)');
  });

  it('prefers gradient fills over solid colors for the dashboard surface', () => {
    expect(
      buildDashboardSurfaceStyle({
        theme_background_color: '#ffffff',
        theme_background_gradient: {
          type: 'linear',
          direction: '180deg',
          colors: ['#ffffff', '#dbeafe'],
        },
      })
    ).toEqual({
      backgroundColor: '#ffffff',
      background: 'linear-gradient(180deg, #ffffff, #dbeafe)',
    });
  });

  it('creates a detached background image layer so blur does not affect dashboard content', () => {
    expect(
      buildDashboardBackgroundImageStyle({
        theme_background_image_url: 'https://example.com/bg.jpg',
        theme_background_image_blur: 6,
      })
    ).toMatchObject({
      position: 'absolute',
      top: -12,
      right: -12,
      bottom: -12,
      left: -12,
      filter: 'blur(6px)',
      pointerEvents: 'none',
      zIndex: 1,
    });
  });

  it('only builds overlay styles when both color and opacity are present', () => {
    expect(
      buildDashboardOverlayStyle({
        theme_overlay_color: '#0f172a',
        theme_overlay_opacity: 0,
      })
    ).toBeNull();

    expect(
      buildDashboardOverlayStyle({
        theme_overlay_color: '#0f172a',
        theme_overlay_opacity: 0.35,
      })
    ).toMatchObject({
      position: 'absolute',
      backgroundColor: '#0f172a',
      opacity: 0.35,
      pointerEvents: 'none',
      zIndex: 2,
    });
  });

  it('serializes theme payloads so clears persist and opaque solid colors stay compatible', () => {
    expect(
      serializeDashboardThemeForApi({
        theme_background_color: '#ffffffff',
        theme_background_gradient: null,
        theme_background_image_url: null,
        theme_background_image_blur: 0,
        theme_chart_opacity: 1,
        theme_overlay_color: null,
        theme_overlay_opacity: 0,
      })
    ).toEqual({
      theme_background_color: '#ffffff',
      theme_background_gradient: {},
      theme_background_image_url: '',
      theme_background_image_blur: 0,
      theme_chart_opacity: 1,
      theme_overlay_color: '',
      theme_overlay_opacity: 0,
    });
  });

  it('round-trips transparent solid fills through the API as single-color gradients', () => {
    const serializedTheme = serializeDashboardThemeForApi({
      theme_background_color: '#11223380',
      theme_background_gradient: null,
    });

    expect(serializedTheme.theme_background_color).toBe('');
    expect(serializedTheme.theme_background_gradient).toEqual({
      type: 'linear',
      direction: '180deg',
      colors: ['#11223380', '#11223380'],
    });

    expect(
      normalizeDashboardTheme({
        theme_background_color: null,
        theme_background_gradient: serializedTheme.theme_background_gradient as any,
      })
    ).toMatchObject({
      theme_background_color: '#11223380',
      theme_background_gradient: null,
    });
  });
});
