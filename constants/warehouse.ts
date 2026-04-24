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

/** IP addresses that should be whitelisted in firewalls for Dalgo access */
export const DALGO_IP_ADDRESSES = ['13.202.128.47', '65.2.173.97'] as const;
