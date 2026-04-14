export const SOURCE_PERMISSIONS = {
  CREATE: 'can_create_source',
  EDIT: 'can_edit_source',
  DELETE: 'can_delete_source',
} as const;

export const SOURCE_API_PATHS = {
  SOURCES: '/api/airbyte/sources',
  SOURCE_DEFINITIONS: '/api/airbyte/source_definitions',
} as const;
