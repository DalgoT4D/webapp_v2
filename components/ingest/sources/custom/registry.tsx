import type { ComponentType } from 'react';
import { GoogleSheetsForm } from './GoogleSheetsForm';
import { KoboToolboxForm } from './KoboToolboxForm';
import { SOURCE_NAME_GOOGLE_SHEETS, SOURCE_NAME_KOBOTOOLBOX } from './constants';
import { DestinationSyncMode } from '@/constants/connections';
import type { CustomSourceFormProps, ConnectionViewConfig } from './types';

export interface CustomSource {
  Form: ComponentType<CustomSourceFormProps>;
  connectionView: ConnectionViewConfig;
}

/**
 * Registry lookup key: case- and whitespace-insensitive source-definition name, so
 * "Google Sheets", "google sheets" and "Google  Sheets" all resolve to the same entry.
 * Mirrors the backend's `_normalize_source_name` (ddpui/core/oauth/google_oauth_provider.py) —
 * a workspace whose catalog spells the connector differently must not lose its custom form
 * while the backend still recognises it for OAuth.
 */
function normalizeSourceName(name: string): string {
  return name.trim().split(/\s+/).join(' ').toLowerCase();
}

// Resolved by Airbyte source-definition *name* (per product decision) — never by
// sourceDefinitionId, which differs per workspace and per connector version.
const CUSTOM_SOURCES: Record<string, CustomSource> = {
  [normalizeSourceName(SOURCE_NAME_GOOGLE_SHEETS)]: {
    Form: GoogleSheetsForm,
    connectionView: {
      streamNoun: 'Sheets',
      supportsIncremental: false,
      allowedDestModes: [DestinationSyncMode.OVERWRITE, DestinationSyncMode.APPEND],
      streamHelp:
        'Each tab in your spreadsheet is one sheet. All of them are synced by default — toggle off any you don’t want to bring into your warehouse.',
    },
  },
  [normalizeSourceName(SOURCE_NAME_KOBOTOOLBOX)]: {
    Form: KoboToolboxForm,
    connectionView: {
      streamNoun: 'Forms',
      supportsIncremental: true,
      allowedDestModes: [
        DestinationSyncMode.OVERWRITE,
        DestinationSyncMode.APPEND,
        DestinationSyncMode.APPEND_DEDUP,
      ],
      streamHelp:
        'Each Kobo form is synced as its own table. All forms are synced by default — toggle off any you don’t want to bring into your warehouse.',
    },
  },
};

/** A custom form exists for this source iff this returns non-null. */
export function getCustomSource(name: string): CustomSource | null {
  return CUSTOM_SOURCES[normalizeSourceName(name)] ?? null;
}

/**
 * Is this source-definition name the Google Sheets connector — the one connector wired to
 * Dalgo's "Sign in with Google" OAuth flow? Matched by name (normalized), so any workspace
 * or connector version whose catalog spells it differently still gets the OAuth path.
 */
export function isGoogleSheetsSource(name: string): boolean {
  return normalizeSourceName(name) === normalizeSourceName(SOURCE_NAME_GOOGLE_SHEETS);
}
