export type WizardStep = 'select' | 'configure' | 'connection';

export const WIZARD_STEPS: { id: WizardStep; label: string }[] = [
  { id: 'select', label: 'Select source' },
  { id: 'configure', label: 'Create source' },
  { id: 'connection', label: 'Connection' },
];

export interface TopSource {
  name: string; // must match the Airbyte source-definition name
  category: string;
}

// Top picker cards, in display order. mGramSeva deferred until its connector id is confirmed.
export const TOP_SOURCES: TopSource[] = [
  { name: 'Google Sheets', category: 'Spreadsheet' },
  { name: 'KoboToolbox', category: 'Survey' },
  { name: 'CommCare', category: 'Field data' },
  { name: 'SurveyCTO', category: 'Survey' },
];

export interface SourceHelp {
  title: string;
  steps: string[];
}

const HELP: Record<string, SourceHelp> = {
  'Google Sheets': {
    title: 'How to connect Google Sheets',
    steps: [
      "Copy your sheet's link — in Google Sheets click Share, then Copy link, and paste it into Spreadsheet link.",
      "Sign in with Google — you'll be asked to grant Dalgo read-only access to your sheets.",
      'Test the connection — confirm Dalgo can read your sheet; you pick which tabs to sync in the next step.',
    ],
  },
};

export function getSourceHelp(name: string): SourceHelp {
  return (
    HELP[name] ?? {
      title: `How to connect ${name}`,
      steps: [
        'Fill in the details on the left.',
        'Enter a name so you can recognise this source later.',
        'Click Next — Dalgo will test the connection before saving.',
      ],
    }
  );
}
