import { savedLinkPointsAt, spreadsheetIdFromSavedValue } from '../utils';

const ID = '1xYTDT4hB9QLB2MXizExHIVFIJYsNEyqmWyUb9Hc_EAw';
const OTHER_ID = '1aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789_-abcde';

describe('savedLinkPointsAt', () => {
  // Every one of these is a real form a Google Sheets link takes. None of them is parsed — the
  // id from the Picker is searched for, so the URL's shape never has to be known.
  it.each([
    [
      'the address bar, with tab',
      `https://docs.google.com/spreadsheets/d/${ID}/edit?gid=1035897582#gid=1035897582`,
    ],
    ['a shared link', `https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing`],
    ['multi-account', `https://docs.google.com/spreadsheets/u/0/d/${ID}/edit`],
    ['a Workspace-domain link', `https://docs.google.com/a/example.org/spreadsheets/d/${ID}/edit`],
    ['no action suffix', `https://docs.google.com/spreadsheets/d/${ID}`],
    ['a CSV export link', `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv`],
    ['a Drive open link', `https://drive.google.com/open?id=${ID}`],
    ['the pre-2014 key form', `https://docs.google.com/spreadsheet/ccc?key=${ID}`],
    ['plain http rather than https', `http://docs.google.com/spreadsheets/d/${ID}/edit`],
    ['a bare id', ID],
    ['a bare id with stray whitespace', `  ${ID}  `],
  ])('recognises its own sheet in %s', (_form, saved) => {
    expect(savedLinkPointsAt(saved, ID)).toBe(true);
  });

  it('does not recognise a different sheet', () => {
    expect(savedLinkPointsAt(`https://docs.google.com/spreadsheets/d/${OTHER_ID}/edit`, ID)).toBe(
      false
    );
    expect(savedLinkPointsAt(OTHER_ID, ID)).toBe(false);
  });

  // Drive ids are case-sensitive, so a case-folded copy is a different file, not the same one.
  it('does not treat a case-folded id as the same sheet', () => {
    expect(savedLinkPointsAt(ID.toLowerCase(), ID)).toBe(false);
  });

  // A "publish to web" link carries a publish token, not the file id — it identifies no file we
  // can compare, and Airbyte cannot sync it either.
  it('does not recognise a published-to-web link', () => {
    expect(
      savedLinkPointsAt('https://docs.google.com/spreadsheets/d/e/2PACX-1vQnotAFileId/pubhtml', ID)
    ).toBe(false);
  });

  it('is false for an empty or missing saved value', () => {
    expect(savedLinkPointsAt('   ', ID)).toBe(false);
    expect(savedLinkPointsAt(undefined, ID)).toBe(false);
    expect(savedLinkPointsAt(null, ID)).toBe(false);
  });

  // Guards the caller from a Picker result that somehow arrived without an id: an empty needle
  // is a substring of everything, which would wave every pick through.
  it('is false when there is no picked id to look for', () => {
    expect(savedLinkPointsAt(`https://docs.google.com/spreadsheets/d/${ID}/edit`, '')).toBe(false);
  });
});

// Extraction, unlike the comparison above, is unavoidable when the id itself is what an API
// needs. It applies Airbyte's own documented rule (source-google-sheets manifest.yaml) rather
// than a guess at URL shapes: the first `/`-prefixed run of 20+ [-\w] characters, or the whole
// value when it is not an http(s) URL.
describe('spreadsheetIdFromSavedValue', () => {
  it.each([
    ['the address bar, with tab', `https://docs.google.com/spreadsheets/d/${ID}/edit?gid=103589`],
    ['multi-account', `https://docs.google.com/spreadsheets/u/0/d/${ID}/edit`],
    ['a Workspace-domain link', `https://docs.google.com/a/example.org/spreadsheets/d/${ID}/edit`],
    ['a CSV export link', `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv`],
    ['plain http rather than https', `http://docs.google.com/spreadsheets/d/${ID}/edit`],
  ])('reads the id out of %s', (_form, saved) => {
    expect(spreadsheetIdFromSavedValue(saved)).toBe(ID);
  });

  it('returns a bare id as-is, whitespace trimmed', () => {
    expect(spreadsheetIdFromSavedValue(`  ${ID}  `)).toBe(ID);
  });

  // Airbyte's rule only looks at `/`-delimited segments, so a query-string id is out of reach.
  // Better to admit that than to invent a second rule: the caller just shows no name.
  it('is null for a link that carries the id in the query string', () => {
    expect(spreadsheetIdFromSavedValue(`https://drive.google.com/open?id=${ID}`)).toBeNull();
  });

  it('is null for an empty or missing value', () => {
    expect(spreadsheetIdFromSavedValue('   ')).toBeNull();
    expect(spreadsheetIdFromSavedValue(undefined)).toBeNull();
  });
});
