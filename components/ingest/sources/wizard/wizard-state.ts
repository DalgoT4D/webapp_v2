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

export interface SourceHelpStep {
  title: string;
  body: string;
}

export interface SourceHelp {
  title: string;
  steps: SourceHelpStep[];
  /** Highlighted "must-know" callout shown below the steps. Optional. */
  note?: string;
}

const HELP: Record<string, SourceHelp> = {
  'Google Sheets': {
    title: 'How to connect Google Sheets',
    steps: [
      {
        title: "Paste your sheet's link",
        body: "Open your spreadsheet, click Share → Copy link, and paste it into Spreadsheet link on the left. Any Google Sheets URL works — you don't need to make it public.",
      },
      {
        title: 'Authorize with Google',
        body: 'Click Sign in with Google and pick the account that can open this sheet. Dalgo asks only for read-only access, and never edits your data.',
      },
    ],
    note: 'The Google account you sign in with must have access to this sheet. If someone else owns it, ask them to share the sheet with your email (Viewer is enough) before you authorize.',
  },
  KoboToolbox: {
    title: 'How to connect KoboToolbox',
    steps: [
      {
        title: 'Enter your KoboToolbox login',
        body: 'Provide the username and password you use to sign in to your KoboToolbox server.',
      },
      {
        title: 'Pick your server and start date',
        body: 'Choose the base URL for your KoboToolbox region, then set the start date — data before it is not synced.',
      },
      {
        title: 'Test & save',
        body: 'Click Next — Dalgo will test the connection before saving. Extra options live under Advanced.',
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
