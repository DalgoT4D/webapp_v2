import type { Warehouse, WarehouseTableRow } from '@/types/warehouse';
import { WAREHOUSE_TYPES } from '@/constants/warehouse';

/**
 * Formats warehouse connection configuration into displayable table rows.
 * Filters out secret values and internal fields.
 */
export function getWarehouseTableData(
  warehouse: Warehouse,
  isSuperAdmin = false
): WarehouseTableRow[] {
  const rows: WarehouseTableRow[] = [];

  const config = warehouse.connectionConfiguration ?? {};
  const wtype = warehouse.wtype?.toLowerCase() ?? '';

  // Type-specific fields
  if (wtype.includes(WAREHOUSE_TYPES.POSTGRES)) {
    addFieldIfPresent(rows, config, 'host', 'Host');
    addFieldIfPresent(rows, config, 'port', 'Port');
    addFieldIfPresent(rows, config, 'database', 'Database');
    if (config.username !== undefined && config.username !== null) {
      rows.push({ label: 'User', value: String(config.username) });
    }
  } else if (wtype.includes(WAREHOUSE_TYPES.BIGQUERY)) {
    addFieldIfPresent(rows, config, 'project_id', 'Project');

    // Dataset: concatenate dataset_id / dataset_location
    if (config.dataset_id || config.dataset_location) {
      const datasetParts = [config.dataset_id, config.dataset_location].filter(Boolean).map(String);
      rows.push({ label: 'Dataset', value: datasetParts.join(' / ') });
    }

    // Loading method
    const loadingMethod = config.loading_method as Record<string, unknown> | undefined;
    if (loadingMethod?.method) {
      rows.push({
        label: 'Loading Method',
        value: String(loadingMethod.method),
      });

      // GCS Staging specific fields
      if (loadingMethod.method === 'GCS Staging') {
        const gcsBucket = loadingMethod.gcs_bucket_name;
        const gcsPath = loadingMethod.gcs_bucket_path;
        if (gcsBucket || gcsPath) {
          const gcsParts = [gcsBucket, gcsPath].filter(Boolean).map(String);
          rows.push({
            label: 'GCS Bucket & Path',
            value: gcsParts.join(' / '),
          });
        }

        const keepFiles = loadingMethod['keep_files_in_gcs-bucket'];
        if (keepFiles !== undefined && keepFiles !== null) {
          rows.push({
            label: 'GCS Temp Files',
            value: String(keepFiles),
          });
        }
      }
    }

    addFieldIfPresent(rows, config, 'transformation_priority', 'Transformation Priority');
  } else if (wtype.includes(WAREHOUSE_TYPES.SNOWFLAKE)) {
    addFieldIfPresent(rows, config, 'host', 'Host');
    if (config.warehouse !== undefined && config.warehouse !== null) {
      rows.push({
        label: 'Compute Warehouse',
        value: String(config.warehouse),
      });
    }
    addFieldIfPresent(rows, config, 'database', 'Database');
    addFieldIfPresent(rows, config, 'schema', 'Schema');
    if (config.username !== undefined && config.username !== null) {
      rows.push({ label: 'User', value: String(config.username) });
    }
    addFieldIfPresent(rows, config, 'role', 'Role');

    const loadingMethod = config.loading_method as Record<string, unknown> | undefined;
    if (loadingMethod?.method) {
      rows.push({
        label: 'Loading Method',
        value: String(loadingMethod.method),
      });
    }
  }

  // Common fields for all types — workspace ID always shown, link only for super admins
  if (warehouse.airbyteWorkspaceId) {
    const airbyteUrl = process.env.NEXT_PUBLIC_AIRBYTE_URL;
    rows.push({
      label: 'Airbyte Workspace ID',
      value: warehouse.airbyteWorkspaceId,
      link:
        isSuperAdmin && airbyteUrl ? `${airbyteUrl}/${warehouse.airbyteWorkspaceId}` : undefined,
    });
  }

  if (warehouse.airbyteDockerRepository) {
    rows.push({
      label: 'Docker Image Tag',
      value: warehouse.airbyteDockerRepository,
    });
  }

  if (warehouse.tag) {
    rows.push({
      label: 'Docker Image Version',
      value: warehouse.tag,
    });
  }

  return rows;
}

/** Helper to push a row if the config key exists */
function addFieldIfPresent(
  rows: WarehouseTableRow[],
  config: Record<string, unknown>,
  key: string,
  label: string
): void {
  if (config[key] !== undefined && config[key] !== null) {
    rows.push({ label, value: String(config[key]) });
  }
}
