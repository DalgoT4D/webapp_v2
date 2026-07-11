import type { ComponentType } from 'react';
import { GoogleSheetsForm } from './GoogleSheetsForm';
import { KoboToolboxForm } from './KoboToolboxForm';
import { SOURCE_NAME_GOOGLE_SHEETS, SOURCE_NAME_KOBOTOOLBOX } from './constants';
import { DestinationSyncMode } from '@/constants/connections';
import type { CustomSourceFormProps, ConnectionViewConfig } from './types';

export interface CustomSource {
  Form: ComponentType<CustomSourceFormProps>;
  helpKey: string;
  connectionView: ConnectionViewConfig;
}

// Resolved by Airbyte source-definition *name* (per product decision).
const CUSTOM_SOURCES: Record<string, CustomSource> = {
  [SOURCE_NAME_GOOGLE_SHEETS]: {
    Form: GoogleSheetsForm,
    helpKey: SOURCE_NAME_GOOGLE_SHEETS,
    connectionView: {
      streamNoun: 'Sheets',
      supportsIncremental: false,
      allowedDestModes: [DestinationSyncMode.OVERWRITE, DestinationSyncMode.APPEND],
      streamHelp:
        'Each tab in your spreadsheet is one sheet. All of them are synced by default — toggle off any you don’t want to bring into your warehouse.',
    },
  },
  [SOURCE_NAME_KOBOTOOLBOX]: {
    Form: KoboToolboxForm,
    helpKey: SOURCE_NAME_KOBOTOOLBOX,
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

/** A custom form + docs panel exist for this source iff this returns non-null. */
export function getCustomSource(name: string): CustomSource | null {
  return CUSTOM_SOURCES[name] ?? null;
}
