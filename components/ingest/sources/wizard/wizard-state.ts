// 'warehouse' is only present when the org has no warehouse yet — it becomes the
// wizard's first step, so the flow reads as 4 steps instead of 3.
export type WizardStep = 'warehouse' | 'select' | 'configure' | 'connection';

export interface TopSource {
  name: string; // must match the Airbyte source-definition name
}

// Popular picker candidates. Their definitions — including their connector logos —
// come from the same live Airbyte catalog used by the full search list.
export const TOP_SOURCES: TopSource[] = [
  { name: 'Google Sheets' },
  { name: 'KoboToolbox' },
  { name: 'Salesforce' },
  { name: 'CommCare' },
  { name: 'Avni' },
  { name: 'Airtable' },
  { name: 'SurveyCTO' },
];
