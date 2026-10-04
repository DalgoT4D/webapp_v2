import type { ChartBuilderFormData } from '@/types/charts';

/** A map layer as stored on a saved chart. */
export interface SavedMapLayer {
  level?: number;
  geographic_column?: string;
  geojson_id?: number;
}

/** The flat drill-down fields the builder UI edits. */
export interface SimplifiedMapFields {
  geographic_column?: string;
  selected_geojson_id?: number;
  district_column?: string;
  ward_column?: string;
  subward_column?: string;
  drill_down_enabled?: boolean;
}

/** A layer as the edit page saves it. */
export interface MapLayerToSave {
  id: string;
  level: number;
  geographic_column: string;
  geojson_id?: number;
  selected_regions: never[];
  parent_selections?: never[];
}

const DRILL_LEVEL_FIELDS = [
  { level: 1, field: 'district_column' },
  { level: 2, field: 'ward_column' },
  { level: 3, field: 'subward_column' },
] as const;

/** Saved layers → the builder's flat fields. */
export function toSimplifiedMapFields(layers: SavedMapLayer[] | undefined): SimplifiedMapFields {
  if (!layers || layers.length === 0) return {};

  const simplified: SimplifiedMapFields = {};
  if (layers[0]?.geographic_column) {
    simplified.geographic_column = layers[0].geographic_column;
    simplified.selected_geojson_id = layers[0].geojson_id;
  }
  DRILL_LEVEL_FIELDS.forEach(({ level, field }) => {
    const layer = layers.find((l) => l.level === level);
    if (layer?.geographic_column) simplified[field] = layer.geographic_column;
  });
  simplified.drill_down_enabled = layers.length > 1;
  return simplified;
}

/**
 * The builder's flat fields → layers to save (edit page).
 *
 * BUILDER-DRIFT: drill-down layers are assigned a running index as their `level`
 * rather than their intended level (1/2/3). If `geographic_column` is blank,
 * the first non-blank drill column becomes level 0 instead of level 1. This
 * matches the original `convertSimplifiedToLayers` in the edit page.
 */
export function toMapLayers(config: ChartBuilderFormData): MapLayerToSave[] | undefined {
  const layers: MapLayerToSave[] = [];

  if (config.geographic_column) {
    layers.push({
      id: '0',
      level: 0,
      geographic_column: config.geographic_column,
      geojson_id: config.selected_geojson_id,
      selected_regions: [],
    });
  }
  DRILL_LEVEL_FIELDS.forEach(({ field }) => {
    const column = config[field];
    if (column && column.trim() !== '') {
      const level = layers.length;
      layers.push({
        id: level.toString(),
        level,
        geographic_column: column,
        selected_regions: [],
        parent_selections: [],
      });
    }
  });
  return layers.length > 0 ? layers : undefined;
}
