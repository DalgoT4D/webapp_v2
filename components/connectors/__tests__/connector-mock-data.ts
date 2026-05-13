/**
 * Mock Airbyte specs and source definitions for testing the connector
 * config form end-to-end: spec → form render → user input → payload.
 *
 * Each fixture mirrors a real-world Airbyte connector pattern.
 */

import type { ConnectionSpecification } from '../types';
import type { SourceDefinition } from '@/types/source';

// ── Source definitions for the combobox ───────────────────────────────────

export const SHAREPOINT_DEF_ID = '59353119-f0f2-4e5a-a8ba-15d887bc34f6';
export const POSTGRES_DEF_ID = 'decd338e-5647-4c0b-adf4-da0e75f5a750';

export function createMockSourceDefinitions(): SourceDefinition[] {
  return [
    {
      sourceDefinitionId: POSTGRES_DEF_ID,
      name: 'Postgres',
      dockerImageTag: '3.6.14',
    },
    {
      sourceDefinitionId: SHAREPOINT_DEF_ID,
      name: 'Microsoft SharePoint',
      dockerImageTag: '0.4.2',
    },
  ];
}

// ── Simple flat spec (e.g. Postgres) ─────────────────────────────────────
export function createFlatSpec(): ConnectionSpecification {
  return {
    type: 'object',
    required: ['host', 'port', 'database'],
    properties: {
      host: {
        type: 'string',
        title: 'Host',
        description: 'Hostname of the database.',
        order: 0,
      },
      port: {
        type: 'integer',
        title: 'Port',
        description: 'Port of the database.',
        default: 5432,
        order: 1,
      },
      database: {
        type: 'string',
        title: 'Database Name',
        order: 2,
      },
      username: {
        type: 'string',
        title: 'Username',
        order: 3,
      },
      password: {
        type: 'string',
        title: 'Password',
        airbyte_secret: true,
        order: 4,
      },
      replication_slot: {
        type: 'string',
        title: 'Replication Slot',
        description: 'Optional replication slot.',
      },
    },
  };
}

// ── Spec with a oneOf (SSH Tunnel) ───────────────────────────────────────
export function createOneOfSpec(): ConnectionSpecification {
  return {
    type: 'object',
    required: ['host', 'tunnel_method'],
    properties: {
      host: {
        type: 'string',
        title: 'Host',
        order: 0,
      },
      tunnel_method: {
        type: 'object',
        title: 'SSH Tunnel Method',
        order: 1,
        oneOf: [
          {
            title: 'No Tunnel',
            properties: {
              tunnel_method: { const: 'NO_TUNNEL' },
            },
            required: [],
          },
          {
            title: 'SSH Key Authentication',
            properties: {
              tunnel_method: { const: 'SSH_KEY_AUTH' },
              tunnel_host: {
                type: 'string',
                title: 'SSH Tunnel Host',
              },
              tunnel_port: {
                type: 'integer',
                title: 'SSH Tunnel Port',
                default: 22,
              },
              ssh_key: {
                type: 'string',
                title: 'SSH Private Key',
                airbyte_secret: true,
                multiline: true,
              },
            },
            required: ['tunnel_host', 'ssh_key'],
          },
          {
            title: 'Password Authentication',
            properties: {
              tunnel_method: { const: 'SSH_PASSWORD_AUTH' },
              tunnel_host: {
                type: 'string',
                title: 'SSH Tunnel Host',
              },
              tunnel_password: {
                type: 'string',
                title: 'SSH Password',
                airbyte_secret: true,
              },
            },
            required: ['tunnel_host', 'tunnel_password'],
          },
        ],
      },
    },
  };
}

// ── Spec with nested oneOf (credentials) ─────────────────────────────────
export function createNestedOneOfSpec(): ConnectionSpecification {
  return {
    type: 'object',
    required: ['credentials'],
    properties: {
      credentials: {
        type: 'object',
        title: 'Authentication',
        oneOf: [
          {
            title: 'OAuth2.0',
            properties: {
              auth_type: { const: 'Client' },
              client_id: { type: 'string', title: 'Client ID' },
              client_secret: {
                type: 'string',
                title: 'Client Secret',
                airbyte_secret: true,
              },
              refresh_token: {
                type: 'string',
                title: 'Refresh Token',
                airbyte_secret: true,
              },
            },
            required: ['client_id', 'client_secret', 'refresh_token'],
          },
          {
            title: 'Service Account',
            properties: {
              auth_type: { const: 'Service' },
              service_account_key: {
                type: 'string',
                title: 'Service Account Key',
                airbyte_secret: true,
                multiline: true,
              },
            },
            required: ['service_account_key'],
          },
        ],
      },
    },
  };
}

// ── Spec with a simple string array ──────────────────────────────────────
export function createSimpleArraySpec(): ConnectionSpecification {
  return {
    type: 'object',
    required: ['schemas'],
    properties: {
      schemas: {
        type: 'array',
        title: 'Schemas',
        description: 'List of schemas to sync.',
        items: { type: 'string' },
        default: ['public'],
      },
    },
  };
}

// ── Spec with an object array (like SharePoint streams) ──────────────────
export function createObjectArraySpec(): ConnectionSpecification {
  return {
    type: 'object',
    required: ['folder_path', 'streams'],
    properties: {
      folder_path: {
        type: 'string',
        title: 'Folder Path',
        default: '.',
        order: 0,
      },
      streams: {
        type: 'array',
        title: 'Streams',
        order: 1,
        items: {
          type: 'object',
          required: ['name', 'globs'],
          properties: {
            name: {
              type: 'string',
              title: 'Name',
            },
            globs: {
              type: 'array',
              title: 'Globs',
              items: { type: 'string' },
              default: ['**'],
            },
            days_to_sync_if_history_is_full: {
              type: 'integer',
              title: 'Days to Sync',
              default: 3,
            },
            schemaless: {
              type: 'boolean',
              title: 'Schemaless',
              default: false,
            },
            validation_policy: {
              type: 'string',
              title: 'Validation Policy',
              default: 'Emit Record',
              enum: ['Emit Record', 'Skip Record', 'Wait for Discover'],
            },
            format: {
              type: 'object',
              title: 'Format',
              oneOf: [
                {
                  title: 'CSV',
                  properties: {
                    filetype: { const: 'csv' },
                    delimiter: {
                      type: 'string',
                      title: 'Delimiter',
                      default: ',',
                    },
                  },
                },
                {
                  title: 'Excel',
                  properties: {
                    filetype: { const: 'excel' },
                  },
                },
                {
                  title: 'Avro',
                  properties: {
                    filetype: { const: 'avro' },
                    double_as_string: {
                      type: 'boolean',
                      title: 'Double as String',
                      default: false,
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  };
}

// ── Full SharePoint-like spec ────────────────────────────────────────────
export function createSharePointSpec(): ConnectionSpecification {
  return {
    type: 'object',
    required: ['credentials', 'search_scope', 'folder_path', 'streams'],
    properties: {
      credentials: {
        type: 'object',
        title: 'Authentication',
        order: 0,
        oneOf: [
          {
            title: 'OAuth2.0',
            properties: {
              auth_type: { const: 'Client' },
              client_id: { type: 'string', title: 'Client ID' },
              client_secret: {
                type: 'string',
                title: 'Client Secret',
                airbyte_secret: true,
              },
              tenant_id: { type: 'string', title: 'Tenant ID' },
              refresh_token: {
                type: 'string',
                title: 'Refresh Token',
                airbyte_secret: true,
              },
            },
            required: ['client_id', 'client_secret', 'tenant_id', 'refresh_token'],
          },
        ],
      },
      search_scope: {
        type: 'string',
        title: 'Search Scope',
        enum: ['ACCESSIBLE_DRIVES', 'SHARED_ITEMS'],
        default: 'ACCESSIBLE_DRIVES',
        order: 1,
      },
      folder_path: {
        type: 'string',
        title: 'Folder Path',
        default: '.',
        order: 2,
      },
      start_date: {
        type: 'string',
        title: 'Start Date',
        description: 'Optional start date.',
      },
      streams: {
        type: 'array',
        title: 'Streams',
        order: 3,
        items: {
          type: 'object',
          required: ['name', 'globs'],
          properties: {
            name: {
              type: 'string',
              title: 'Name',
            },
            globs: {
              type: 'array',
              title: 'Globs',
              items: { type: 'string' },
              default: ['**'],
            },
            days_to_sync_if_history_is_full: {
              type: 'integer',
              title: 'Days to Sync',
              default: 3,
            },
            schemaless: {
              type: 'boolean',
              title: 'Schemaless',
              default: false,
            },
            validation_policy: {
              type: 'string',
              title: 'Validation Policy',
              default: 'Emit Record',
              enum: ['Emit Record', 'Skip Record', 'Wait for Discover'],
            },
            format: {
              type: 'object',
              title: 'Format',
              oneOf: [
                {
                  title: 'Excel',
                  properties: {
                    filetype: { const: 'excel' },
                  },
                },
                {
                  title: 'CSV',
                  properties: {
                    filetype: { const: 'csv' },
                    delimiter: {
                      type: 'string',
                      title: 'Delimiter',
                      default: ',',
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  };
}

// ── Spec with mixed defaults (boolean, number, integer) ──────────────────
export function createMixedDefaultsSpec(): ConnectionSpecification {
  return {
    type: 'object',
    required: ['host'],
    properties: {
      host: {
        type: 'string',
        title: 'Host',
      },
      port: {
        type: 'integer',
        title: 'Port',
        default: 5432,
      },
      ssl: {
        type: 'boolean',
        title: 'Use SSL',
        default: true,
      },
      connection_timeout: {
        type: 'number',
        title: 'Connection Timeout',
        default: 30.5,
      },
    },
  };
}

// ── Spec with hidden fields ──────────────────────────────────────────────
export function createHiddenFieldSpec(): ConnectionSpecification {
  return {
    type: 'object',
    required: ['host'],
    properties: {
      host: {
        type: 'string',
        title: 'Host',
      },
      internal_id: {
        type: 'string',
        title: 'Internal ID',
        airbyte_hidden: true,
        default: 'auto-generated',
      },
    },
  };
}

// ── Spec with single-value enum discriminator (MySQL pattern) ────────────
export function createSingleEnumDiscriminatorSpec(): ConnectionSpecification {
  return {
    type: 'object',
    required: ['replication_method'],
    properties: {
      replication_method: {
        type: 'object',
        title: 'Replication Method',
        oneOf: [
          {
            title: 'Standard',
            properties: {
              method: { enum: ['STANDARD'] },
            },
          },
          {
            title: 'CDC',
            properties: {
              method: { enum: ['CDC'] },
              server_id: {
                type: 'integer',
                title: 'Server ID',
                default: 1,
              },
            },
            required: ['server_id'],
          },
        ],
      },
    },
  };
}
