import { parseAirbyteSpec } from '../spec-parser';
import type { ConnectionSpecification } from '../types';

// ============ Minimal inline specs for focused unit tests ============

const flatSpec: ConnectionSpecification = {
  type: 'object',
  required: ['host', 'port'],
  properties: {
    host: {
      type: 'string',
      title: 'Host',
      order: 0,
      description: 'Hostname',
    },
    port: {
      type: 'integer',
      title: 'Port',
      order: 1,
      default: 5432,
      minimum: 0,
      maximum: 65536,
    },
    database: {
      type: 'string',
      title: 'Database',
      order: 2,
    },
    password: {
      type: 'string',
      title: 'Password',
      airbyte_secret: true,
    },
  },
};

const oneOfSpec: ConnectionSpecification = {
  type: 'object',
  required: ['credentials'],
  properties: {
    credentials: {
      type: 'object',
      title: 'Authentication',
      oneOf: [
        {
          title: 'OAuth',
          required: ['auth_type', 'client_id'],
          properties: {
            auth_type: { type: 'string', const: 'oauth' },
            client_id: {
              type: 'string',
              title: 'Client ID',
              airbyte_secret: true,
            },
          },
        },
        {
          title: 'Service Account',
          required: ['auth_type', 'service_key'],
          properties: {
            auth_type: { type: 'string', const: 'service' },
            service_key: {
              type: 'string',
              title: 'Service Key',
              airbyte_secret: true,
              multiline: true,
            },
          },
        },
      ],
    },
  },
};

const arraySpec: ConnectionSpecification = {
  type: 'object',
  properties: {
    schemas: {
      type: 'array',
      title: 'Schemas',
      items: { type: 'string' },
      default: ['public'],
    },
  },
};

const hiddenFieldSpec: ConnectionSpecification = {
  type: 'object',
  properties: {
    visible: { type: 'string', title: 'Visible' },
    hidden: { type: 'string', title: 'Hidden', airbyte_hidden: true },
  },
};

const groupSpec: ConnectionSpecification = {
  type: 'object',
  groups: [
    { id: 'db', title: 'Database' },
    { id: 'auth', title: 'Auth' },
  ],
  required: ['host'],
  properties: {
    host: { type: 'string', title: 'Host', group: 'db', order: 0 },
    username: { type: 'string', title: 'Username', group: 'auth', order: 1 },
  },
};

const enumSpec: ConnectionSpecification = {
  type: 'object',
  properties: {
    mode: {
      type: 'string',
      title: 'Mode',
      enum: ['full_refresh', 'incremental', 'cdc'],
    },
  },
};

const booleanSpec: ConnectionSpecification = {
  type: 'object',
  properties: {
    use_ssl: {
      type: 'boolean',
      title: 'Use SSL',
      default: false,
    },
  },
};

const radioOneOfSpec: ConnectionSpecification = {
  type: 'object',
  properties: {
    replication: {
      type: 'object',
      title: 'Replication Method',
      display_type: 'radio',
      oneOf: [
        {
          title: 'CDC',
          required: ['method'],
          properties: {
            method: { type: 'string', const: 'CDC' },
            slot: { type: 'string', title: 'Replication Slot' },
          },
        },
        {
          title: 'Standard',
          required: ['method'],
          properties: {
            method: { type: 'string', const: 'Standard' },
          },
        },
      ],
    },
  },
};

// ============ Tests ============

describe('parseAirbyteSpec', () => {
  describe('flat properties', () => {
    it('parses basic string, integer fields with correct types', () => {
      const result = parseAirbyteSpec(flatSpec);

      expect(result.fields).toHaveLength(4);

      const host = result.fields.find((f) => f.path[0] === 'host');
      expect(host).toBeDefined();
      expect(host!.type).toBe('basic');
      expect(host!.fieldType).toBe('string');
      expect(host!.required).toBe(true);
      expect(host!.order).toBe(0);

      const port = result.fields.find((f) => f.path[0] === 'port');
      expect(port).toBeDefined();
      expect(port!.type).toBe('basic');
      expect(port!.fieldType).toBe('integer');
      expect(port!.default).toBe(5432);
      expect(port!.minimum).toBe(0);
      expect(port!.maximum).toBe(65536);
    });

    it('marks secret fields', () => {
      const result = parseAirbyteSpec(flatSpec);
      const password = result.fields.find((f) => f.path[0] === 'password');
      expect(password!.isSecret).toBe(true);
    });

    it('sorts fields by order, then required, then alphabetically', () => {
      const result = parseAirbyteSpec(flatSpec);
      const titles = result.fields.map((f) => f.title);
      // host (order 0), port (order 1), database (order 2) come first
      // password (no order, not required) comes last
      expect(titles).toEqual(['Host', 'Port', 'Database', 'Password']);
    });
  });

  describe('hidden fields', () => {
    it('skips airbyte_hidden fields', () => {
      const result = parseAirbyteSpec(hiddenFieldSpec);
      expect(result.fields).toHaveLength(1);
      expect(result.fields[0].title).toBe('Visible');
    });
  });

  describe('boolean fields', () => {
    it('parses boolean fields correctly', () => {
      const result = parseAirbyteSpec(booleanSpec);
      expect(result.fields).toHaveLength(1);
      expect(result.fields[0].type).toBe('boolean');
      expect(result.fields[0].default).toBe(false);
    });
  });

  describe('enum fields', () => {
    it('parses enum fields and sorts values alphabetically', () => {
      const result = parseAirbyteSpec(enumSpec);
      expect(result.fields).toHaveLength(1);
      const mode = result.fields[0];
      expect(mode.type).toBe('enum');
      expect(mode.enumValues).toEqual(['cdc', 'full_refresh', 'incremental']);
    });
  });

  describe('oneOf fields', () => {
    it('finds const discriminator and extracts options', () => {
      const result = parseAirbyteSpec(oneOfSpec);
      const creds = result.fields[0];

      expect(creds.type).toBe('oneOf');
      expect(creds.constKey).toBe('auth_type');
      expect(creds.constOptions).toHaveLength(2);
      expect(creds.constOptions![0].value).toBe('oauth');
      expect(creds.constOptions![1].value).toBe('service');
    });

    it('parses sub-fields with parentValue tags', () => {
      const result = parseAirbyteSpec(oneOfSpec);
      const creds = result.fields[0];

      const oauthFields = creds.oneOfSubFields!.filter((f) => f.parentValue === 'oauth');
      expect(oauthFields).toHaveLength(1);
      expect(oauthFields[0].path).toEqual(['credentials', 'client_id']);
      expect(oauthFields[0].isSecret).toBe(true);

      const serviceFields = creds.oneOfSubFields!.filter((f) => f.parentValue === 'service');
      expect(serviceFields).toHaveLength(1);
      expect(serviceFields[0].isMultiline).toBe(true);
    });

    it('preserves display_type for radio rendering', () => {
      const result = parseAirbyteSpec(radioOneOfSpec);
      const replication = result.fields[0];
      expect(replication.displayType).toBe('radio');
    });
  });

  describe('array fields', () => {
    it('parses simple array (string[])', () => {
      const result = parseAirbyteSpec(arraySpec);
      const schemas = result.fields[0];

      expect(schemas.type).toBe('array');
      expect(schemas.arrayItemType).toBe('simple');
      expect(schemas.default).toEqual(['public']);
    });
  });

  describe('groups', () => {
    it('preserves groups from spec', () => {
      const result = parseAirbyteSpec(groupSpec);
      expect(result.groups).toHaveLength(2);
      expect(result.groups[0].id).toBe('db');
      expect(result.groups[1].id).toBe('auth');
    });

    it('assigns group to fields', () => {
      const result = parseAirbyteSpec(groupSpec);
      const host = result.fields.find((f) => f.path[0] === 'host');
      expect(host!.group).toBe('db');
    });
  });

  describe('real-world specs', () => {
    it('parses a Postgres-like spec with nested oneOf and groups', () => {
      // Simplified version of the real Postgres spec
      const postgresLike: ConnectionSpecification = {
        type: 'object',
        groups: [{ id: 'db', title: 'Database' }],
        required: ['host', 'port', 'database'],
        properties: {
          host: { type: 'string', title: 'Host', group: 'db', order: 0 },
          port: {
            type: 'integer',
            title: 'Port',
            group: 'db',
            order: 1,
            default: 5432,
          },
          database: {
            type: 'string',
            title: 'Database',
            group: 'db',
            order: 2,
          },
          ssl_mode: {
            type: 'object',
            title: 'SSL Mode',
            oneOf: [
              {
                title: 'disable',
                required: ['mode'],
                properties: {
                  mode: { type: 'string', const: 'disable' },
                },
              },
              {
                title: 'require',
                required: ['mode'],
                properties: {
                  mode: { type: 'string', const: 'require' },
                },
              },
              {
                title: 'verify-ca',
                required: ['mode', 'ca_certificate'],
                properties: {
                  mode: { type: 'string', const: 'verify-ca' },
                  ca_certificate: {
                    type: 'string',
                    title: 'CA Certificate',
                    multiline: true,
                    airbyte_secret: true,
                  },
                },
              },
            ],
          },
        },
      };

      const result = parseAirbyteSpec(postgresLike);

      // Groups preserved
      expect(result.groups).toHaveLength(1);

      // All top-level fields parsed
      expect(result.fields).toHaveLength(4);

      // SSL mode is oneOf with 3 options
      const ssl = result.fields.find((f) => f.path[0] === 'ssl_mode');
      expect(ssl!.type).toBe('oneOf');
      expect(ssl!.constKey).toBe('mode');
      expect(ssl!.constOptions).toHaveLength(3);

      // verify-ca has sub-field ca_certificate
      const verifyCaFields = ssl!.oneOfSubFields!.filter((f) => f.parentValue === 'verify-ca');
      expect(verifyCaFields).toHaveLength(1);
      expect(verifyCaFields[0].title).toBe('CA Certificate');
      expect(verifyCaFields[0].isMultiline).toBe(true);
      expect(verifyCaFields[0].isSecret).toBe(true);
    });
  });
});
