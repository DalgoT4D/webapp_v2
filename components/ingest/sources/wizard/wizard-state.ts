export type WizardStep = 'select' | 'configure' | 'connection';

export interface TopSource {
  name: string; // must match the Airbyte source-definition name
  category: string;
}

// Popular picker candidates. Only the two custom-UI sources are surfaced as cards;
// every other connector stays reachable through the search box. Any whose name has
// no matching live source-definition in the deployment is dropped (see SelectSourceStep).
export const MAX_TOP_CARDS = 2;

export const TOP_SOURCES: TopSource[] = [
  { name: 'Google Sheets', category: 'Spreadsheet' },
  { name: 'KoboToolbox', category: 'Survey' },
];
