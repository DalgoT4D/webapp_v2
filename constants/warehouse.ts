/** WebSocket endpoint for destination connection check */
export const DESTINATION_CHECK_WS_PATH = 'airbyte/destination/check_connection';

/** Known warehouse types for display formatting */
export const WAREHOUSE_TYPES = {
  POSTGRES: 'postgres',
  BIGQUERY: 'bigquery',
  SNOWFLAKE: 'snowflake',
} as const;

/** IP addresses that should be whitelisted in firewalls for Dalgo access */
export const DALGO_IP_ADDRESSES = ['13.202.128.47', '65.2.173.97'] as const;
