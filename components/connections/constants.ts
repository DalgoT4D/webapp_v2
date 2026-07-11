export type ConnectionConceptId =
  | 'stream'
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

// Plain-language explanations shown in the connection help panel. `impact`
// tells the user the practical consequence of each choice.
export const CONNECTION_HELP: ConnectionConcept[] = [
  {
    id: 'stream',
    title: 'Streams',
    body: 'A stream is one table of data the source can send — a tab in a sheet, a form in KoboToolbox. You choose which ones to bring in.',
    impact: 'Sync only what you need. Fewer streams means faster, cheaper syncs.',
  },
  {
    id: 'sync-mode',
    title: 'Full refresh vs incremental',
    body: 'Full refresh re-reads everything every run. Incremental reads only rows added since the last run, tracked by a cursor field.',
    impact:
      'A daily full refresh on a large dataset is slow and heavy. Incremental is much lighter, but the source must support it and needs a cursor.',
  },
  {
    id: 'dest-mode',
    title: 'Write mode',
    body: 'Overwrite replaces the whole table each run. Append adds new rows to what is already there. Append + Dedup adds rows but removes duplicates using a primary key.',
    impact:
      'Overwrite keeps the table exactly matching the source but is heavier. Append preserves history but can pile up duplicates. Dedup needs incremental + a primary key.',
  },
  {
    id: 'cursor',
    title: 'Cursor field',
    body: 'The column Dalgo uses to tell what is new — usually a date or an ever-increasing ID.',
    impact:
      'Required for incremental sync. Pick a column that only moves forward, like a submission timestamp.',
  },
  {
    id: 'primary-key',
    title: 'Primary key',
    body: 'One or more columns that uniquely identify a row.',
    impact:
      'Required for Append + Dedup so Dalgo knows which rows are the same record and can drop duplicates.',
  },
  {
    id: 'schema',
    title: 'Destination schema',
    body: 'The schema (folder) in your warehouse where the synced tables are created. Defaults to staging.',
    impact: 'Keeps raw ingested data separate from your transformed models.',
  },
  {
    id: 'normalize',
    title: 'Normalize after sync',
    body: 'Flattens nested JSON from the source into typed, columnar tables after each sync.',
    impact:
      'Handy when the source sends nested data. Leave off if the source is already flat, like a spreadsheet.',
  },
];
