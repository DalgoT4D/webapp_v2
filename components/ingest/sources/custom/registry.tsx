import type { ComponentType } from 'react';
import { GoogleSheetsForm } from './GoogleSheetsForm';
import { KoboToolboxForm } from './KoboToolboxForm';
import { SOURCE_NAME_GOOGLE_SHEETS, SOURCE_NAME_KOBOTOOLBOX } from './constants';
import type { CustomSourceFormProps } from './types';

export interface CustomSource {
  Form: ComponentType<CustomSourceFormProps>;
  helpKey: string;
}

// Resolved by Airbyte source-definition *name* (per product decision).
const CUSTOM_SOURCES: Record<string, CustomSource> = {
  [SOURCE_NAME_GOOGLE_SHEETS]: { Form: GoogleSheetsForm, helpKey: SOURCE_NAME_GOOGLE_SHEETS },
  [SOURCE_NAME_KOBOTOOLBOX]: { Form: KoboToolboxForm, helpKey: SOURCE_NAME_KOBOTOOLBOX },
};

/** A custom form + docs panel exist for this source iff this returns non-null. */
export function getCustomSource(name: string): CustomSource | null {
  return CUSTOM_SOURCES[name] ?? null;
}
