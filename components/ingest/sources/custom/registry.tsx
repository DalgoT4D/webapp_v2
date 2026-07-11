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
      streamNoun: 'Tabs',
      supportsIncremental: false,
      allowedDestModes: [DestinationSyncMode.OVERWRITE, DestinationSyncMode.APPEND],
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
    },
  },
};

/** A custom form + docs panel exist for this source iff this returns non-null. */
export function getCustomSource(name: string): CustomSource | null {
  return CUSTOM_SOURCES[name] ?? null;
}
