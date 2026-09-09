import fs from 'fs';
import path from 'path';
import { featureForPathname } from '@/constants/analytics';

/**
 * `feature:viewed` fires off PATHNAME_TO_FEATURE, so a page whose route isn't in that list is
 * simply invisible in navigation analytics — silently, with nothing failing. That is exactly
 * what happened when the warehouse moved out of the ingest page onto its own Settings route.
 *
 * There is no generic '/settings' fallback, so every settings sub-route needs its own entry.
 * This walks the real app directory instead of a hand-kept list, so a NEW page added tomorrow
 * fails here rather than going unmeasured.
 */
const APP_DIR = path.resolve(__dirname, '../../app');

/** Route paths of every settings page that exists on disk. */
function settingsRoutes(): string[] {
  const settingsDir = path.join(APP_DIR, 'settings');
  return fs
    .readdirSync(settingsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => fs.existsSync(path.join(settingsDir, entry.name, 'page.tsx')))
    .map((entry) => `/settings/${entry.name}`);
}

describe('feature:viewed route coverage', () => {
  it('maps every settings page that exists on disk', () => {
    const unmapped = settingsRoutes().filter((route) => featureForPathname(route) === null);

    expect(unmapped).toEqual([]);
  });

  it('maps the warehouse settings route specifically', () => {
    expect(featureForPathname('/settings/warehouse')).toBe('settings_warehouse');
  });

  // Guards the matcher itself: a prefix must not swallow a sibling route.
  // /settings/access, not /settings/user-management: resource sharing moved that page, and
  // the feature name stayed SETTINGS_USER_MANAGEMENT so the metric keeps its history.
  it('keeps sibling settings routes distinct', () => {
    expect(featureForPathname('/settings/branding')).toBe('settings_branding');
    expect(featureForPathname('/settings/access')).toBe('settings_user_management');
  });
});
