/** API endpoints for warehouse operations */
export const WAREHOUSE_API = {
  LIST: '/api/organizations/warehouses',
  CREATE: '/api/organizations/warehouse/',
  DESTINATION_DEFINITIONS: '/api/airbyte/destination_definitions',
  DESTINATION_SPEC: (defId: string) =>
    `/api/airbyte/destination_definitions/${defId}/specifications`,
  DESTINATION_EDIT_SPEC: (destId: string) => `/api/airbyte/destinations/${destId}/specifications`,
  UPDATE: (destId: string) => `/api/airbyte/v1/destinations/${destId}/`,
  DELETE: '/api/v1/organizations/warehouses/',
} as const;

/** WebSocket endpoint for destination connection check */
export const DESTINATION_CHECK_WS_PATH = 'airbyte/destination/check_connection';

/** Known warehouse types for display formatting */
export const WAREHOUSE_TYPES = {
  POSTGRES: 'postgres',
  BIGQUERY: 'bigquery',
  SNOWFLAKE: 'snowflake',
} as const;

/** Permission slugs for warehouse operations */
export const WAREHOUSE_PERMISSIONS = {
  CREATE: 'can_create_warehouse',
  EDIT: 'can_edit_warehouse',
  DELETE: 'can_delete_warehouses',
} as const;
