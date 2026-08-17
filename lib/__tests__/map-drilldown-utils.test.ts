import { resolveDrillDownGeoJSON } from '../map-drilldown-utils';

describe('resolveDrillDownGeoJSON', () => {
  it('uses the configured boundary outside drill-down mode', () => {
    expect(
      resolveDrillDownGeoJSON({
        isDrillDownActive: false,
        regionGeojsonsLoading: false,
        fallbackGeojsonId: 12,
      })
    ).toEqual({ geojsonId: 12, isResolving: false });
  });

  it('keeps the map loading while a dynamic drill-down boundary is being resolved', () => {
    expect(
      resolveDrillDownGeoJSON({
        isDrillDownActive: true,
        regionId: 2,
        regionGeojsonsLoading: true,
        fallbackGeojsonId: 0,
      })
    ).toEqual({ geojsonId: null, isResolving: true });
  });

  it('uses the resolved regional boundary when the lookup completes', () => {
    expect(
      resolveDrillDownGeoJSON({
        isDrillDownActive: true,
        regionId: 2,
        regionGeojsons: [{ id: 44 }],
        regionGeojsonsLoading: false,
        fallbackGeojsonId: 0,
      })
    ).toEqual({ geojsonId: 44, isResolving: false });
  });

  it('does not hide a completed empty lookup behind an infinite loading state', () => {
    expect(
      resolveDrillDownGeoJSON({
        isDrillDownActive: true,
        regionId: 2,
        regionGeojsons: [],
        regionGeojsonsLoading: false,
        fallbackGeojsonId: 0,
      })
    ).toEqual({ geojsonId: null, isResolving: false });
  });

  it('lets a lookup error surface instead of continuing to load', () => {
    expect(
      resolveDrillDownGeoJSON({
        isDrillDownActive: true,
        regionId: 2,
        regionGeojsonsLoading: false,
        regionGeojsonsError: new Error('lookup failed'),
        fallbackGeojsonId: 0,
      })
    ).toEqual({ geojsonId: null, isResolving: false });
  });
});
