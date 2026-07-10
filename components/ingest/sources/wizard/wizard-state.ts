export type WizardStep = 'select' | 'configure' | 'connection';

export interface TopSource {
  name: string; // must match the Airbyte source-definition name
  category: string;
}

// Popular picker candidates, in preference order. Any whose name has no matching
// live source-definition in the deployment is dropped, then the list is capped to
// MAX_TOP_CARDS (see SelectSourceStep). The trailing entries are reliable
// fallbacks so the grid still fills when a preferred connector isn't installed.
export const MAX_TOP_CARDS = 5;

export const TOP_SOURCES: TopSource[] = [
  { name: 'Google Sheets', category: 'Spreadsheet' },
  { name: 'KoboToolbox', category: 'Survey' },
  { name: 'mGramSeva', category: 'Field data' },
  { name: 'SurveyCTO', category: 'Survey' },
  { name: 'CommCare', category: 'Field data' },
  { name: 'Postgres', category: 'Database' },
  { name: 'Airtable', category: 'Spreadsheet' },
];

export interface SourceHelpStep {
  title: string;
  body: string;
}

export interface SourceHelp {
  title: string;
  steps: SourceHelpStep[];
}

const HELP: Record<string, SourceHelp> = {
  'Google Sheets': {
    title: 'How to connect Google Sheets',
    steps: [
      {
        title: "Copy your sheet's link",
        body: 'In Google Sheets, click Share, Copy link. Paste it into Spreadsheet link on the left.',
      },
      {
        title: 'Sign in with Google',
        body: "Click Sign in with Google. You'll be asked to grant Dalgo read-only access to your sheets.",
      },
      {
        title: 'Test the connection',
        body: "Hit Test to confirm Dalgo can read your sheet. You'll pick which tabs to sync in the next step.",
      },
    ],
  },
};

export function getSourceHelp(name: string): SourceHelp {
  return (
    HELP[name] ?? {
      title: `How to connect ${name}`,
      steps: [
        { title: 'Fill in the details', body: 'Complete the fields on the left.' },
        {
          title: 'Name your source',
          body: 'Enter a name so you can recognise this source later.',
        },
        {
          title: 'Test & save',
          body: 'Click Next — Dalgo will test the connection before saving.',
        },
      ],
    }
  );
}
