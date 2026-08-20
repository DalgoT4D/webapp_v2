import { savedLinkPointsAt } from '../utils';

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
