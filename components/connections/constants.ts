import { DestinationSyncMode } from '@/constants/connections';

export type ConnectionConceptId =
  | 'sync'
  | 'stream'
  | 'columns'
  | 'sync-mode'
  | 'dest-mode'
  | 'cursor'
  | 'primary-key'
  | 'schema'
  | 'normalize';

export interface ConnectionConcept {
  id: ConnectionConceptId;
  title: string;
  body: string;
  impact: string;
}

// Concrete number used in the "impact" examples so the trade-off feels real to a
// non-engineer reading the panel, rather than abstract ("large dataset").
const EXAMPLE_ROW_COUNT = '10,000';

interface HelpOptions {
  // Column label for a stream in this source, e.g. "Sheets", "Forms", "Streams".
  streamNoun?: string;
  // Source offers incremental sync (adds the cursor + full/incremental concepts).
  supportsIncremental?: boolean;
  // Source offers Append + Dedup (adds the primary-key concept + dedup copy).
  allowsDedup?: boolean;
  // Spreadsheet-style source: data is already flat, so normalize is not relevant.
  isFlatSource?: boolean;
}

/**
 * Build the help cards for the connection panel, tailored to the source. Custom
 * sources (Google Sheets, KoboToolbox) pass their capabilities so we only show
 * concepts that apply — e.g. Sheets never sees incremental, cursor, or dedup.
 * Called with no options it returns the full generic set (used for all other
 * Airbyte sources, and by tests).
 */
export function getConnectionHelp(opts: HelpOptions = {}): ConnectionConcept[] {
  const {
    streamNoun = 'Streams',
    supportsIncremental = true,
    allowsDedup = true,
    isFlatSource = false,
  } = opts;

  const nounSingular = streamNoun.replace(/s$/i, '').toLowerCase();
  const nounPlural = streamNoun.toLowerCase();

  const cards: ConnectionConcept[] = [];

  // Always start with the big picture — most NGO users have never set up a sync.
  cards.push({
    id: 'sync',
    title: 'What a sync does',
    body: 'A sync copies data from your source into your Dalgo warehouse. It runs on the schedule you set, and each run brings the latest data across so your dashboards and reports stay current.',
    impact:
      'Dalgo only reads from the source — nothing there is changed. You can re-run a sync any time.',
  });

  cards.push({
    id: 'stream',
    title: streamNoun,
    body: `Each ${nounSingular} is one table Dalgo can pull — a tab in a spreadsheet, a Kobo form, or a table in a database. Toggle one off to leave it out of the sync.`,
    impact: `Bring in only what you need. Fewer ${nounPlural} means faster, lighter syncs and a tidier warehouse.`,
  });

  cards.push({
    id: 'columns',
    title: 'Columns',
    body: `Open a ${nounSingular} to see its columns — the individual fields inside it, like "district" or "submission_date". Every column comes across when the ${nounSingular} is synced.`,
    impact: `A quick way to confirm the fields you expect are really there before you run the sync.`,
  });

  // Full-refresh vs incremental only makes sense where the source supports it.
  if (supportsIncremental) {
    cards.push({
      id: 'sync-mode',
      title: 'Full refresh vs incremental',
      body: 'Full refresh reads every row on every run. Incremental reads only the rows added or changed since the last run, tracked by a cursor field.',
      impact: `Say a form has ${EXAMPLE_ROW_COUNT} submissions. Full refresh re-copies all ${EXAMPLE_ROW_COUNT} every run — dependable, but slow and heavier on the source. Incremental copies just the new ones (perhaps 50 today), so runs finish in seconds and cost far less.`,
    });
  }

  // Write-mode copy depends on which modes this source actually offers.
  cards.push({
    id: 'dest-mode',
    title: 'Write mode',
    body: allowsDedup
      ? 'How new data lands in the warehouse table. Overwrite replaces the whole table each run. Append adds new rows on top of what is there. Append + Dedup appends, then drops duplicate records using a primary key.'
      : 'How new data lands in the warehouse table. Overwrite replaces the whole table each run, so it always matches the source. Append adds new rows on top of what is already there.',
    impact: allowsDedup
      ? 'Overwrite always mirrors the source but rewrites everything each run. Append keeps history but can pile up duplicates. Append + Dedup keeps history without duplicates — it needs incremental plus a primary key.'
      : `Pick Overwrite when the ${nounSingular} is edited in place and you want an exact copy each run. Pick Append when rows are only ever added and you want to keep the older ones.`,
  });

  if (supportsIncremental) {
    cards.push({
      id: 'cursor',
      title: 'Cursor field',
      body: 'The column Dalgo watches to know what is new — usually a date or an ever-increasing ID, like a submission timestamp.',
      impact:
        'Required for incremental sync. Pick a column that only moves forward and is never edited backwards, otherwise new rows can be missed.',
    });
  }

  if (allowsDedup) {
    cards.push({
      id: 'primary-key',
      title: 'Primary key',
      body: 'One or more columns that uniquely identify a record — for example a submission ID.',
      impact: 'Required for Append + Dedup, so Dalgo can tell two rows apart and remove repeats.',
    });
  }

  cards.push({
    id: 'schema',
    title: 'Destination schema',
    body: "The schema — a folder inside your warehouse — where these tables are created. Defaults to 'staging'.",
    impact: 'Keeps freshly ingested data separate from your cleaned, transformed models.',
  });

  // Schema + Normalize fields always render in the form, so both cards are always
  // present — the copy itself tells flat-source users they can leave Normalize off.
  cards.push({
    id: 'normalize',
    title: 'Normalize after sync',
    body: 'Flattens nested data from the source into plain, typed columns after each run.',
    impact: isFlatSource
      ? 'Not needed for a flat source like a spreadsheet — the data is already in columns. Leave it off.'
      : 'Helpful for sources that send nested records, like Kobo. Leave it off if the source is already flat.',
  });

  return cards;
}

// Generic full set — used for all non-custom Airbyte sources and by tests.
export const CONNECTION_HELP: ConnectionConcept[] = getConnectionHelp();

// Convenience flag: does this source's write-mode list include Append + Dedup?
export function allowsDedup(modes: DestinationSyncMode[]): boolean {
  return modes.includes(DestinationSyncMode.APPEND_DEDUP);
}
