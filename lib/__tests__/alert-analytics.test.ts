import fs from 'fs';
import path from 'path';
import { ALERT_CREATE_SOURCES } from '@/constants/analytics';

/**
 * The alert wizard is opened from four different surfaces. ALERT_CREATED is only useful if
 * each one identifies itself, and a fifth entry point added without a createSource would
 * silently fall back to 'alerts_page' — so guard the wiring, not just the constant.
 */
const REPO = path.resolve(__dirname, '../..');

const ENTRY_POINTS: Record<string, string> = {
  'app/alerts/page.tsx': ALERT_CREATE_SOURCES.ALERTS_PAGE,
  'components/metrics/metrics-library.tsx': ALERT_CREATE_SOURCES.METRICS_LIBRARY,
  'components/kpis/kpi-page.tsx': ALERT_CREATE_SOURCES.KPI_LIST,
  'components/kpis/kpi-detail-drawer.tsx': ALERT_CREATE_SOURCES.KPI_DRAWER,
};

function read(file: string) {
  return fs.readFileSync(path.join(REPO, file), 'utf8');
}

describe('alert analytics wiring', () => {
  it('every file that mounts AlertWizardModal is a known entry point', () => {
    const mounts = Object.keys(ENTRY_POINTS);
    for (const file of mounts) {
      expect(read(file)).toContain('<AlertWizardModal');
    }
  });

  // The alerts page relies on the prop's default rather than passing it explicitly.
  it('non-default entry points pass an explicit createSource', () => {
    for (const [file, source] of Object.entries(ENTRY_POINTS)) {
      if (source === ALERT_CREATE_SOURCES.ALERTS_PAGE) continue;
      expect(read(file)).toContain('createSource={ALERT_CREATE_SOURCES.');
      expect(read(file)).toContain(`ALERT_CREATE_SOURCES.${sourceKey(source)}`);
    }
  });

  // The dry-run on the Test step runs from a useEffect on every payload change, so it
  // measures the wizard rather than the user — it must stay untracked (same reasoning as
  // dashboard autosave). This fails if someone instruments it.
  it('does not track the automatic dry-run', () => {
    expect(read('components/alerts/AlertTestStep.tsx')).not.toContain('trackEvent');
  });
});

function sourceKey(value: string): string {
  const entry = Object.entries(ALERT_CREATE_SOURCES).find(([, v]) => v === value);
  return entry![0];
}
