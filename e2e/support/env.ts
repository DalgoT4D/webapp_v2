import path from 'path';

/**
 * Central E2E configuration. Values come from `.env` (gitignored).
 * See e2e/coverage/staging-data.md for the org + datasets these tests rely on.
 */

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';
export const ORG_SLUG = process.env.E2E_ORG_SLUG || 'trial-d05b1ddb-faram';

// Shared across all workers of one `playwright test` invocation (set in playwright.config.ts)
export const RUN_ID = process.env.E2E_RUN_ID || 'local';

// Every object a test creates carries this prefix so teardown can find it
export const E2E_PREFIX = 'e2e-';

const AUTH_DIR = path.resolve(__dirname, '../../playwright/.auth');
export const AUTH_STATE_PATH = path.join(AUTH_DIR, 'admin.json');

/**
 * Users per org role. Admin is the default session for every spec.
 * member/analyst are optional — permission specs skip via `requireRole()` when creds are absent.
 */
export type RoleName = 'admin' | 'member' | 'analyst';
export const ROLE_USERS: Record<
  RoleName,
  { email?: string; password?: string; statePath: string }
> = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL,
    password: process.env.E2E_ADMIN_PASSWORD,
    statePath: AUTH_STATE_PATH,
  },
  member: {
    email: process.env.E2E_MEMBER_EMAIL,
    password: process.env.E2E_MEMBER_PASSWORD,
    statePath: path.join(AUTH_DIR, 'member.json'),
  },
  analyst: {
    email: process.env.E2E_ANALYST_EMAIL,
    password: process.env.E2E_ANALYST_PASSWORD,
    statePath: path.join(AUTH_DIR, 'analyst.json'),
  },
};

export function hasRole(role: RoleName): boolean {
  return Boolean(ROLE_USERS[role].email && ROLE_USERS[role].password);
}

/**
 * Baseline switches. OFF by default: the baselines (JSON + PNG files under e2e/__snapshots__) are gitignored
 * and live only on the machine that recorded them from the pre-refactor code. Turn them on locally
 * in `.env` (E2E_PAYLOAD_SNAPSHOTS=on, E2E_SCREENSHOTS=on). With them off, every E2E flow and
 * every other assertion still runs — only the stored-baseline comparisons are skipped.
 */
export const PAYLOAD_SNAPSHOTS_ENABLED = process.env.E2E_PAYLOAD_SNAPSHOTS === 'on';
export const SCREENSHOTS_ENABLED = process.env.E2E_SCREENSHOTS === 'on';

/** Title for a test-created object: `e2e-<runId>-<name>` */
export function e2eTitle(name: string): string {
  return `${E2E_PREFIX}${RUN_ID}-${name}`;
}

/** Stable seed data on staging. READ-ONLY — tests must never edit or delete these. */
export const SEED = {
  dashboards: { health: 411, education: 412 },
  reports: { education: 150, health: 151 },
  datasets: {
    education: { schema: 'production', table: 'mart_education_program' },
    menstrual: { schema: 'production', table: 'mart_health_menstrual_distribution' },
    childDev: { schema: 'production', table: 'mart_health_child_development' },
    maternal: { schema: 'production', table: 'mart_health_maternal_risk' },
    clinic: { schema: 'production', table: 'mart_health_clinic_delivery' },
    chatbot: { schema: 'production', table: 'mart_health_chatbot_operations' },
  },
} as const;
