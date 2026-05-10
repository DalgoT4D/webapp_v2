/**
 * End-to-end integration tests for connector config form.
 *
 * Flow tested: Airbyte spec → parseAirbyteSpec → extractSpecDefaults →
 *   render ConnectorConfigForm → fill fields → getValues → cleanFormValues →
 *   assert payload matches expected API format.
 *
 * These tests catch the exact bugs we fixed:
 *   - Flat dot-notation keys leaking into the payload
 *   - Arrays (e.g. streams) sent as objects instead of []
 *   - Array sub-field defaults polluting the root config
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, type UseFormReturn, type FieldValues } from 'react-hook-form';
import { ConnectorConfigForm } from '../ConnectorConfigForm';
import { parseAirbyteSpec } from '../spec-parser';
import { cleanFormValues, extractSpecDefaults } from '../utils';
import type { ParsedSpec } from '../types';
import type { ConnectionSpecification } from '../types';
import {
  createFlatSpec,
  createOneOfSpec,
  createNestedOneOfSpec,
  createSimpleArraySpec,
  createObjectArraySpec,
  createSharePointSpec,
  createMixedDefaultsSpec,
  createHiddenFieldSpec,
  createSingleEnumDiscriminatorSpec,
} from './connector-mock-data';

// ═══════════════════════════════════════════════════════════════════════════
// Test harness — wraps ConnectorConfigForm in a real useForm and exposes
// getValues + cleanFormValues via a submit button.
// ═══════════════════════════════════════════════════════════════════════════

let capturedPayload: Record<string, unknown> | null = null;
let formRef: UseFormReturn<FieldValues> | null = null;

interface HarnessProps {
  spec: ConnectionSpecification;
}

function TestHarness({ spec }: HarnessProps) {
  const parsedSpec = parseAirbyteSpec(spec);
  const defaults = extractSpecDefaults(parsedSpec);

  const form = useForm({ defaultValues: defaults });
  formRef = form;

  const onSubmit = () => {
    const raw = form.getValues();
    const cleaned = cleanFormValues(raw, parsedSpec.fields);
    capturedPayload = cleaned;
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} data-testid="test-form">
      <ConnectorConfigForm
        parsedSpec={parsedSpec}
        control={form.control}
        setValue={form.setValue}
      />
      <button type="submit" data-testid="submit-btn">
        Submit
      </button>
    </form>
  );
}

function renderHarness(spec: ConnectionSpecification) {
  capturedPayload = null;
  formRef = null;
  return render(<TestHarness spec={spec} />);
}

async function submitAndCapture(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('submit-btn'));
  // handleSubmit is async — wait for the payload to be captured
  await waitFor(() => {
    expect(capturedPayload).not.toBeNull();
  });
  return capturedPayload!;
}

// ═══════════════════════════════════════════════════════════════════════════
// Unit tests: extractSpecDefaults
// ═══════════════════════════════════════════════════════════════════════════

describe('extractSpecDefaults', () => {
  it('returns nested objects, never flat dot-notation keys', () => {
    const specs = [
      createFlatSpec(),
      createOneOfSpec(),
      createNestedOneOfSpec(),
      createSharePointSpec(),
      createMixedDefaultsSpec(),
      createSingleEnumDiscriminatorSpec(),
    ];

    for (const spec of specs) {
      const parsed = parseAirbyteSpec(spec);
      const defaults = extractSpecDefaults(parsed);
      for (const key of Object.keys(defaults)) {
        expect(key).not.toContain('.');
      }
    }
  });

  it('extracts basic field defaults', () => {
    const defaults = extractSpecDefaults(parseAirbyteSpec(createFlatSpec()));
    expect(defaults).toEqual({ port: 5432 });
  });

  it('extracts boolean and number defaults', () => {
    const defaults = extractSpecDefaults(parseAirbyteSpec(createMixedDefaultsSpec()));
    expect(defaults.port).toBe(5432);
    expect(defaults.ssl).toBe(true);
    expect(defaults.connection_timeout).toBe(30.5);
  });

  it('extracts oneOf discriminator default (first option)', () => {
    const defaults = extractSpecDefaults(parseAirbyteSpec(createOneOfSpec()));
    expect(defaults.tunnel_method).toEqual({ tunnel_method: 'NO_TUNNEL' });
  });

  it('extracts nested oneOf defaults', () => {
    const defaults = extractSpecDefaults(parseAirbyteSpec(createNestedOneOfSpec()));
    expect(defaults.credentials).toEqual({ auth_type: 'Client' });
  });

  it('includes sub-field defaults only for the default option', () => {
    // SSH_KEY_AUTH has tunnel_port:22 but NO_TUNNEL is default → no tunnel_port
    const defaults = extractSpecDefaults(parseAirbyteSpec(createOneOfSpec()));
    expect(defaults.tunnel_method).not.toHaveProperty('tunnel_port');
  });

  it('extracts simple array default', () => {
    const defaults = extractSpecDefaults(parseAirbyteSpec(createSimpleArraySpec()));
    expect(defaults.schemas).toEqual(['public']);
  });

  it('does NOT set array sub-field defaults at the root level', () => {
    const defaults = extractSpecDefaults(parseAirbyteSpec(createObjectArraySpec()));

    // streams must NOT become an object with sub-field keys
    if (defaults.streams !== undefined) {
      expect(typeof defaults.streams).not.toBe('object');
    }
    // No flat keys either
    expect(defaults).not.toHaveProperty('streams.globs');
    expect(defaults).not.toHaveProperty('streams.format.filetype');
    expect(defaults).not.toHaveProperty('streams.days_to_sync_if_history_is_full');
  });

  it('handles single-enum discriminator (MySQL pattern)', () => {
    const defaults = extractSpecDefaults(parseAirbyteSpec(createSingleEnumDiscriminatorSpec()));
    expect(defaults.replication_method).toEqual({ method: 'STANDARD' });
  });

  it('skips hidden fields', () => {
    const defaults = extractSpecDefaults(parseAirbyteSpec(createHiddenFieldSpec()));
    expect(defaults).not.toHaveProperty('internal_id');
  });

  it('produces correct SharePoint defaults', () => {
    const defaults = extractSpecDefaults(parseAirbyteSpec(createSharePointSpec()));
    expect((defaults.credentials as Record<string, unknown>).auth_type).toBe('Client');
    expect(defaults.search_scope).toBe('ACCESSIBLE_DRIVES');
    expect(defaults.folder_path).toBe('.');

    // streams must not be an object
    const s = defaults.streams;
    if (s !== undefined) {
      expect(Array.isArray(s) || typeof s !== 'object').toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Unit tests: cleanFormValues
// ═══════════════════════════════════════════════════════════════════════════

describe('cleanFormValues', () => {
  it('coerces string → integer for integer fields', () => {
    const fields = parseAirbyteSpec(createFlatSpec()).fields;
    const result = cleanFormValues({ host: 'h', port: '3306', database: 'd' }, fields);
    expect(result.port).toBe(3306);
    expect(typeof result.port).toBe('number');
  });

  it('coerces string → number for number fields', () => {
    const fields = parseAirbyteSpec(createMixedDefaultsSpec()).fields;
    const result = cleanFormValues({ host: 'h', connection_timeout: '30.5' }, fields);
    expect(result.connection_timeout).toBe(30.5);
  });

  it('rounds to integer for integer fields', () => {
    const fields = parseAirbyteSpec(createFlatSpec()).fields;
    const result = cleanFormValues({ host: 'h', port: '5432.7', database: 'd' }, fields);
    expect(result.port).toBe(5433);
  });

  it('leaves non-numeric strings unchanged', () => {
    const fields = parseAirbyteSpec(createFlatSpec()).fields;
    const result = cleanFormValues({ host: 'h', port: 'abc', database: 'd' }, fields);
    expect(result.port).toBe('abc');
  });

  it('removes empty string on integer fields instead of coercing to 0', () => {
    const fields = parseAirbyteSpec(createFlatSpec()).fields;
    const result = cleanFormValues({ host: 'h', port: '', database: 'd' }, fields);
    expect(result).not.toHaveProperty('port');
  });

  it('removes empty string on number fields instead of coercing to 0', () => {
    const fields = parseAirbyteSpec(createMixedDefaultsSpec()).fields;
    const result = cleanFormValues({ host: 'h', connection_timeout: '' }, fields);
    expect(result).not.toHaveProperty('connection_timeout');
  });

  it('removes empty string on integer fields inside array items', () => {
    const fields = parseAirbyteSpec(createObjectArraySpec()).fields;
    const input = {
      folder_path: '.',
      streams: [{ name: 's', globs: ['*'], days_to_sync_if_history_is_full: '' }],
    };
    const result = cleanFormValues(input, fields);
    const stream = (result.streams as Record<string, unknown>[])[0];
    expect(stream).not.toHaveProperty('days_to_sync_if_history_is_full');
  });

  it('removes empty/null/undefined start_date', () => {
    const fields = parseAirbyteSpec(createSharePointSpec()).fields;
    expect(cleanFormValues({ start_date: '' }, fields)).not.toHaveProperty('start_date');
    expect(cleanFormValues({ start_date: null }, fields)).not.toHaveProperty('start_date');
    expect(cleanFormValues({ start_date: undefined }, fields)).not.toHaveProperty('start_date');
  });

  it('keeps non-empty start_date', () => {
    const fields = parseAirbyteSpec(createSharePointSpec()).fields;
    expect(cleanFormValues({ start_date: '2024-01-01' }, fields).start_date).toBe('2024-01-01');
  });

  it('strips all flat dot-notation keys', () => {
    const fields = parseAirbyteSpec(createSharePointSpec()).fields;
    const input = {
      credentials: { auth_type: 'Client', client_id: 'a' },
      streams: [],
      // dot-notation artifacts from RHF
      'credentials.auth_type': 'Client',
      'credentials.client_id': 'a',
      'streams.globs': ['**'],
      'streams.format.filetype': 'avro',
    };
    const result = cleanFormValues(input, fields);
    for (const key of Object.keys(result)) {
      expect(key).not.toContain('.');
    }
    // nested values preserved
    expect(result.credentials).toEqual({ auth_type: 'Client', client_id: 'a' });
  });

  it('coerces integers inside object array items', () => {
    const fields = parseAirbyteSpec(createObjectArraySpec()).fields;
    const input = {
      folder_path: '.',
      streams: [{ name: 's', globs: ['*'], days_to_sync_if_history_is_full: '5' }],
    };
    const result = cleanFormValues(input, fields);
    const stream = (result.streams as Record<string, unknown>[])[0];
    expect(stream.days_to_sync_if_history_is_full).toBe(5);
  });

  it('coerces integers in multiple array items', () => {
    const fields = parseAirbyteSpec(createObjectArraySpec()).fields;
    const input = {
      folder_path: '.',
      streams: [
        { name: 'a', globs: ['*'], days_to_sync_if_history_is_full: '3' },
        { name: 'b', globs: ['*'], days_to_sync_if_history_is_full: '7' },
      ],
    };
    const result = cleanFormValues(input, fields);
    const streams = result.streams as Record<string, unknown>[];
    expect(streams[0].days_to_sync_if_history_is_full).toBe(3);
    expect(streams[1].days_to_sync_if_history_is_full).toBe(7);
  });

  it('coerces nested oneOf integer fields', () => {
    const fields = parseAirbyteSpec(createOneOfSpec()).fields;
    const input = {
      host: 'h',
      tunnel_method: {
        tunnel_method: 'SSH_KEY_AUTH',
        tunnel_host: 'bastion',
        tunnel_port: '22',
        ssh_key: 'key',
      },
    };
    const result = cleanFormValues(input, fields);
    expect((result.tunnel_method as Record<string, unknown>).tunnel_port).toBe(22);
  });

  it('does not mutate the original input', () => {
    const fields = parseAirbyteSpec(createFlatSpec()).fields;
    const input = { host: 'h', port: '5432', database: 'd' };
    const copy = structuredClone(input);
    cleanFormValues(input, fields);
    expect(input).toEqual(copy);
  });

  it('handles empty input gracefully', () => {
    const fields = parseAirbyteSpec(createFlatSpec()).fields;
    expect(cleanFormValues({}, fields)).toEqual({});
  });

  it('handles empty streams array', () => {
    const fields = parseAirbyteSpec(createObjectArraySpec()).fields;
    const result = cleanFormValues({ folder_path: '.', streams: [] }, fields);
    expect(result.streams).toEqual([]);
  });

  it('produces correct SharePoint payload (full integration)', () => {
    const fields = parseAirbyteSpec(createSharePointSpec()).fields;
    const input = {
      credentials: {
        auth_type: 'Client',
        client_id: 'cid',
        client_secret: 'cs',
        tenant_id: 'tid',
        refresh_token: 'rt',
      },
      search_scope: 'ACCESSIBLE_DRIVES',
      folder_path: '.',
      streams: [
        {
          name: 'sales',
          globs: ['/sales.xlsx'],
          format: { filetype: 'excel' },
          days_to_sync_if_history_is_full: '3',
          schemaless: false,
          validation_policy: 'Emit Record',
        },
      ],
      // dot-notation artifacts
      'credentials.auth_type': 'Client',
      'streams.globs': ['**'],
      'streams.format.filetype': 'avro',
      'streams.days_to_sync_if_history_is_full': 3,
      'streams.schemaless': false,
    };

    const result = cleanFormValues(input, fields);

    expect(result).toEqual({
      credentials: {
        auth_type: 'Client',
        client_id: 'cid',
        client_secret: 'cs',
        tenant_id: 'tid',
        refresh_token: 'rt',
      },
      search_scope: 'ACCESSIBLE_DRIVES',
      folder_path: '.',
      streams: [
        {
          name: 'sales',
          globs: ['/sales.xlsx'],
          format: { filetype: 'excel' },
          days_to_sync_if_history_is_full: 3,
          schemaless: false,
          validation_policy: 'Emit Record',
        },
      ],
    });

    // No dot keys
    for (const key of Object.keys(result)) {
      expect(key).not.toContain('.');
    }
    // streams is an array
    expect(Array.isArray(result.streams)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E2E integration: render form → fill fields → submit → check payload
// ═══════════════════════════════════════════════════════════════════════════

describe('ConnectorConfigForm E2E', () => {
  // Helper to type into an input identified by data-testid
  async function typeIntoField(
    user: ReturnType<typeof userEvent.setup>,
    testId: string,
    value: string
  ) {
    const input = screen.getByTestId(testId);
    await user.clear(input);
    await user.type(input, value);
  }

  describe('flat spec (Postgres-like)', () => {
    it('renders all fields and submits correct nested payload', async () => {
      const user = userEvent.setup();
      renderHarness(createFlatSpec());

      // Fill fields
      await typeIntoField(user, 'input-host', 'myhost.example.com');
      await typeIntoField(user, 'input-port', '3306');
      await typeIntoField(user, 'input-database', 'production');
      await typeIntoField(user, 'input-username', 'admin');
      await typeIntoField(user, 'input-password', 's3cret');

      const payload = await submitAndCapture(user);

      expect(payload.host).toBe('myhost.example.com');
      expect(payload.port).toBe(3306); // coerced from string
      expect(payload.database).toBe('production');
      expect(payload.username).toBe('admin');
      expect(payload.password).toBe('s3cret');

      // No dot-notation keys
      for (const key of Object.keys(payload)) {
        expect(key).not.toContain('.');
      }
    });

    it('uses spec defaults when fields are not touched', async () => {
      const user = userEvent.setup();
      renderHarness(createFlatSpec());

      // Only fill required fields, leave port at default (5432)
      await typeIntoField(user, 'input-host', 'h');
      await typeIntoField(user, 'input-database', 'd');

      const payload = await submitAndCapture(user);

      expect(payload.port).toBe(5432);
    });
  });

  describe('mixed defaults spec', () => {
    it('preserves boolean and number defaults in payload', async () => {
      const user = userEvent.setup();
      renderHarness(createMixedDefaultsSpec());

      await typeIntoField(user, 'input-host', 'localhost');

      const payload = await submitAndCapture(user);

      expect(payload.ssl).toBe(true);
      expect(payload.connection_timeout).toBe(30.5);
      expect(payload.port).toBe(5432);
    });
  });

  describe('oneOf spec (SSH tunnel)', () => {
    it('submits correct nested payload with NO_TUNNEL default', async () => {
      const user = userEvent.setup();
      renderHarness(createOneOfSpec());

      await typeIntoField(user, 'input-host', 'db.example.com');

      const payload = await submitAndCapture(user);

      expect(payload.host).toBe('db.example.com');
      expect(payload.tunnel_method).toBeDefined();
      expect((payload.tunnel_method as Record<string, unknown>).tunnel_method).toBe('NO_TUNNEL');

      // No dot-notation keys
      for (const key of Object.keys(payload)) {
        expect(key).not.toContain('.');
      }
    });
  });

  describe('simple array spec', () => {
    it('uses array default and submits as array', async () => {
      const user = userEvent.setup();
      renderHarness(createSimpleArraySpec());

      const payload = await submitAndCapture(user);

      expect(Array.isArray(payload.schemas)).toBe(true);
      expect(payload.schemas).toEqual(['public']);
    });
  });

  describe('object array spec (streams)', () => {
    it('submits empty streams array when no items added', async () => {
      const user = userEvent.setup();
      renderHarness(createObjectArraySpec());

      const payload = await submitAndCapture(user);

      expect(payload.folder_path).toBe('.');
      // streams should not exist or be an empty array (useFieldArray default)
      if (payload.streams !== undefined) {
        expect(Array.isArray(payload.streams)).toBe(true);
      }

      // Must NOT have dot-notation keys
      for (const key of Object.keys(payload)) {
        expect(key).not.toContain('.');
      }
    });

    it('streams defaults do not leak as flat keys or nested object keys', async () => {
      const user = userEvent.setup();
      renderHarness(createObjectArraySpec());

      const payload = await submitAndCapture(user);

      // No dot-notation keys at root
      for (const key of Object.keys(payload)) {
        expect(key).not.toContain('.');
      }

      // If streams exists, it must be an array not { globs: [...], format: {...} }
      if (payload.streams !== undefined) {
        expect(Array.isArray(payload.streams)).toBe(true);
      }
    });

    it('adds a stream item and submits as proper array', async () => {
      const user = userEvent.setup();
      renderHarness(createObjectArraySpec());

      // Click "Add Item" button for streams
      const addBtn = screen.getByTestId('add-item-streams');
      await user.click(addBtn);

      // Fill in the stream name
      await waitFor(() => {
        expect(screen.getByTestId('array-item-streams-0')).toBeInTheDocument();
      });

      await typeIntoField(user, 'input-streams.0.name', 'my_stream');

      const payload = await submitAndCapture(user);

      expect(Array.isArray(payload.streams)).toBe(true);
      const streams = payload.streams as Record<string, unknown>[];
      expect(streams.length).toBe(1);
      expect(streams[0].name).toBe('my_stream');

      // No dot-notation keys at root
      for (const key of Object.keys(payload)) {
        expect(key).not.toContain('.');
      }
    });

    it('adds multiple stream items', async () => {
      const user = userEvent.setup();
      renderHarness(createObjectArraySpec());

      const addBtn = screen.getByTestId('add-item-streams');
      await user.click(addBtn);
      await user.click(addBtn);

      await waitFor(() => {
        expect(screen.getByTestId('array-item-streams-1')).toBeInTheDocument();
      });

      await typeIntoField(user, 'input-streams.0.name', 'stream_a');
      await typeIntoField(user, 'input-streams.1.name', 'stream_b');

      const payload = await submitAndCapture(user);

      expect(Array.isArray(payload.streams)).toBe(true);
      const streams = payload.streams as Record<string, unknown>[];
      expect(streams.length).toBe(2);
      expect(streams[0].name).toBe('stream_a');
      expect(streams[1].name).toBe('stream_b');
    });
  });

  describe('SharePoint-like spec (full E2E)', () => {
    it('submits correct nested payload matching old webapp format', async () => {
      const user = userEvent.setup();
      renderHarness(createSharePointSpec());

      // Fill credentials (oneOf sub-fields — "Client" is the default)
      await typeIntoField(user, 'input-credentials.client_id', 'my-client-id');
      await typeIntoField(user, 'input-credentials.client_secret', 'my-secret');
      await typeIntoField(user, 'input-credentials.tenant_id', 'my-tenant');
      await typeIntoField(user, 'input-credentials.refresh_token', 'my-token');

      // Add a stream
      const addBtn = screen.getByTestId('add-item-streams');
      await user.click(addBtn);

      await waitFor(() => {
        expect(screen.getByTestId('array-item-streams-0')).toBeInTheDocument();
      });

      await typeIntoField(user, 'input-streams.0.name', 'sales_data');

      // Add a glob to the stream's globs array
      const globInput = screen.getByTestId('input-streams.0.globs');
      await user.type(globInput, '/sales.xlsx{enter}');

      const payload = await submitAndCapture(user);

      // Credentials must be nested
      expect(payload.credentials).toBeDefined();
      const creds = payload.credentials as Record<string, unknown>;
      expect(creds.auth_type).toBe('Client');
      expect(creds.client_id).toBe('my-client-id');
      expect(creds.client_secret).toBe('my-secret');
      expect(creds.tenant_id).toBe('my-tenant');
      expect(creds.refresh_token).toBe('my-token');

      // Enum default
      expect(payload.search_scope).toBe('ACCESSIBLE_DRIVES');

      // Basic default
      expect(payload.folder_path).toBe('.');

      // Streams must be a proper array
      expect(Array.isArray(payload.streams)).toBe(true);
      const streams = payload.streams as Record<string, unknown>[];
      expect(streams.length).toBe(1);
      expect(streams[0].name).toBe('sales_data');

      // No dot-notation keys anywhere
      for (const key of Object.keys(payload)) {
        expect(key).not.toContain('.');
      }

      // start_date should be cleaned if empty
      expect(payload).not.toHaveProperty('start_date');
    });
  });
});
