/**
 * Tests the spec parser against REAL Airbyte spec JSON files
 * to verify it handles all production patterns correctly.
 */
import { parseAirbyteSpec } from '../spec-parser';
import type { ConnectionSpecification, FieldNode } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const SPEC_DIR = path.resolve(__dirname, '../../..');

function loadSpec(filename: string): ConnectionSpecification {
  const raw = fs.readFileSync(path.join(SPEC_DIR, filename), 'utf-8');
  return JSON.parse(raw);
}

function findField(fields: FieldNode[], key: string): FieldNode | undefined {
  for (const field of fields) {
    if (field.path[field.path.length - 1] === key) return field;
    if (field.oneOfSubFields) {
      const found = findField(field.oneOfSubFields, key);
      if (found) return found;
    }
    if (field.arraySubFields) {
      const found = findField(field.arraySubFields, key);
      if (found) return found;
    }
  }
  return undefined;
}

describe('parseAirbyteSpec — real specs', () => {
  // ============ POSTGRES SOURCE ============
  describe('postgres.json (source)', () => {
    const spec = loadSpec('postgres.json');
    const parsed = parseAirbyteSpec(spec);

    it('parses without errors', () => {
      expect(parsed).toBeDefined();
      expect(parsed.fields.length).toBeGreaterThan(0);
    });

    it('has groups', () => {
      expect(parsed.groups.length).toBeGreaterThan(0);
      const groupIds = parsed.groups.map((g) => g.id);
      expect(groupIds).toContain('db');
      expect(groupIds).toContain('auth');
      expect(groupIds).toContain('security');
      expect(groupIds).toContain('advanced');
    });

    it('parses host as required basic string', () => {
      const host = findField(parsed.fields, 'host');
      expect(host).toBeDefined();
      expect(host!.type).toBe('basic');
      expect(host!.fieldType).toBe('string');
      expect(host!.required).toBe(true);
      expect(host!.group).toBe('db');
    });

    it('parses port as integer with min/max/default', () => {
      const port = findField(parsed.fields, 'port');
      expect(port).toBeDefined();
      expect(port!.type).toBe('basic');
      expect(port!.fieldType).toBe('integer');
      expect(port!.default).toBe(5432);
      expect(port!.minimum).toBe(0);
      expect(port!.maximum).toBe(65536);
    });

    it('parses password as secret field', () => {
      const password = findField(parsed.fields, 'password');
      expect(password).toBeDefined();
      expect(password!.isSecret).toBe(true);
    });

    it('parses schemas as simple array', () => {
      const schemas = findField(parsed.fields, 'schemas');
      expect(schemas).toBeDefined();
      expect(schemas!.type).toBe('array');
      expect(schemas!.arrayItemType).toBe('simple');
      expect(schemas!.default).toEqual(['public']);
    });

    it('parses ssl_mode as oneOf with 6 options', () => {
      const sslMode = findField(parsed.fields, 'ssl_mode');
      expect(sslMode).toBeDefined();
      expect(sslMode!.type).toBe('oneOf');
      expect(sslMode!.constKey).toBe('mode');
      expect(sslMode!.constOptions!.length).toBe(6);
      const optionValues = sslMode!.constOptions!.map((o) => o.value);
      expect(optionValues).toContain('disable');
      expect(optionValues).toContain('verify-ca');
      expect(optionValues).toContain('verify-full');
    });

    it('parses verify-ca sub-fields (multiline + secret)', () => {
      const sslMode = findField(parsed.fields, 'ssl_mode');
      const verifyCaFields = sslMode!.oneOfSubFields!.filter((f) => f.parentValue === 'verify-ca');
      expect(verifyCaFields.length).toBeGreaterThan(0);

      const caCert = verifyCaFields.find((f) => f.path[f.path.length - 1] === 'ca_certificate');
      expect(caCert).toBeDefined();
      expect(caCert!.isMultiline).toBe(true);
      expect(caCert!.isSecret).toBe(true);
    });

    it('parses tunnel_method as oneOf with 3 options', () => {
      const tunnel = findField(parsed.fields, 'tunnel_method');
      expect(tunnel).toBeDefined();
      expect(tunnel!.type).toBe('oneOf');
      expect(tunnel!.constKey).toBe('tunnel_method');
      expect(tunnel!.constOptions!.length).toBe(3);
    });

    it('parses replication_method with display_type radio', () => {
      const replication = findField(parsed.fields, 'replication_method');
      expect(replication).toBeDefined();
      expect(replication!.type).toBe('oneOf');
      expect(replication!.displayType).toBe('radio');
      expect(replication!.constKey).toBe('method');
    });

    it('parses CDC sub-fields with enums', () => {
      const replication = findField(parsed.fields, 'replication_method');
      const cdcFields = replication!.oneOfSubFields!.filter((f) => f.parentValue === 'CDC');
      expect(cdcFields.length).toBeGreaterThan(0);

      const plugin = cdcFields.find((f) => f.path[f.path.length - 1] === 'plugin');
      expect(plugin).toBeDefined();
      expect(plugin!.type).toBe('enum');
      expect(plugin!.enumValues).toContain('pgoutput');
    });

    it('parses boolean field (entra_service_principal_auth)', () => {
      const entra = findField(parsed.fields, 'entra_service_principal_auth');
      expect(entra).toBeDefined();
      expect(entra!.type).toBe('boolean');
      expect(entra!.default).toBe(false);
    });
  });

  // ============ GOOGLE SHEETS SOURCE ============
  describe('gsheet.json (source)', () => {
    const spec = loadSpec('gsheet.json');
    const parsed = parseAirbyteSpec(spec);

    it('parses without errors', () => {
      expect(parsed).toBeDefined();
      expect(parsed.fields.length).toBeGreaterThan(0);
    });

    it('parses credentials as oneOf with OAuth vs Service Account', () => {
      const creds = findField(parsed.fields, 'credentials');
      expect(creds).toBeDefined();
      expect(creds!.type).toBe('oneOf');
      expect(creds!.constKey).toBe('auth_type');
      expect(creds!.constOptions!.length).toBe(2);

      const oauthOption = creds!.constOptions!.find((o) => o.value === 'Client');
      expect(oauthOption).toBeDefined();
      expect(oauthOption!.title).toBe('Authenticate via Google (OAuth)');

      const serviceOption = creds!.constOptions!.find((o) => o.value === 'Service');
      expect(serviceOption).toBeDefined();
    });

    it('parses OAuth sub-fields as secret', () => {
      const creds = findField(parsed.fields, 'credentials');
      const oauthFields = creds!.oneOfSubFields!.filter((f) => f.parentValue === 'Client');
      expect(oauthFields.length).toBe(3); // client_id, client_secret, refresh_token

      for (const field of oauthFields) {
        expect(field.isSecret).toBe(true);
      }
    });

    it('parses batch_size as integer with default', () => {
      const batchSize = findField(parsed.fields, 'batch_size');
      expect(batchSize).toBeDefined();
      expect(batchSize!.type).toBe('basic');
      expect(batchSize!.fieldType).toBe('integer');
      expect(batchSize!.default).toBe(200);
    });
  });

  // ============ DESTINATION BIGQUERY ============
  describe('destination_bigquery.json', () => {
    const spec = loadSpec('destination_bigquery.json');
    const parsed = parseAirbyteSpec(spec);

    it('parses without errors', () => {
      expect(parsed).toBeDefined();
      expect(parsed.fields.length).toBeGreaterThan(0);
    });

    it('has groups', () => {
      expect(parsed.groups.length).toBeGreaterThan(0);
    });

    it('parses loading_method as oneOf (GCS Staging vs Standard)', () => {
      const loading = findField(parsed.fields, 'loading_method');
      expect(loading).toBeDefined();
      expect(loading!.type).toBe('oneOf');
      expect(loading!.constKey).toBe('method');
    });

    it('parses nested oneOf (loading_method > credential)', () => {
      const loading = findField(parsed.fields, 'loading_method');
      const gcsFields = loading!.oneOfSubFields!.filter((f) => f.parentValue === 'GCS Staging');

      // Look for a nested oneOf (credential)
      const credential = gcsFields.find((f) => f.path[f.path.length - 1] === 'credential');
      expect(credential).toBeDefined();
      expect(credential!.type).toBe('oneOf');
      expect(credential!.constKey).toBe('credential_type');
    });
  });

  // ============ DESTINATION POSTGRES ============
  describe('destination_postgres.json', () => {
    const spec = loadSpec('destination_postgres.json');
    const parsed = parseAirbyteSpec(spec);

    it('parses without errors', () => {
      expect(parsed).toBeDefined();
      expect(parsed.fields.length).toBeGreaterThan(0);
    });
  });

  // ============ MYSQL SOURCE ============
  describe('mysql.json (source)', () => {
    const spec = loadSpec('mysql.json');
    const parsed = parseAirbyteSpec(spec);

    it('parses without errors', () => {
      expect(parsed).toBeDefined();
      expect(parsed.fields.length).toBeGreaterThan(0);
    });
  });

  // ============ COMMCARE SOURCE ============
  describe('commcare.json (source)', () => {
    const spec = loadSpec('commcare.json');
    const parsed = parseAirbyteSpec(spec);

    it('parses without errors', () => {
      expect(parsed).toBeDefined();
      expect(parsed.fields.length).toBeGreaterThan(0);
    });
  });

  // ============ GOOGLE DRIVE SOURCE ============
  describe('googledrive.json (source)', () => {
    const spec = loadSpec('googledrive.json');
    const parsed = parseAirbyteSpec(spec);

    it('parses without errors', () => {
      expect(parsed).toBeDefined();
      expect(parsed.fields.length).toBeGreaterThan(0);
    });
  });

  // ============ S3 SOURCE ============
  describe('s3.json (source)', () => {
    const spec = loadSpec('s3.json');
    const parsed = parseAirbyteSpec(spec);

    it('parses without errors', () => {
      expect(parsed).toBeDefined();
      expect(parsed.fields.length).toBeGreaterThan(0);
    });
  });

  // ============ BIGQUERY SOURCE ============
  describe('bigquery.json (source)', () => {
    const spec = loadSpec('bigquery.json');
    const parsed = parseAirbyteSpec(spec);

    it('parses without errors', () => {
      expect(parsed).toBeDefined();
      expect(parsed.fields.length).toBeGreaterThan(0);
    });
  });
});
