import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { ROLE_USERS } from '../support/env';
import { createReport, createReportDashboard, toast, withStableIds } from './helpers';
import { openReport, orgUserId } from './helpers-gaps';
import { fetchForRewrite } from '../support/routes';

const GRANTS_URL = (reportId: number) => new RegExp(`/api/access/report/${reportId}/grants$`);
const GENERAL_ACCESS_URL = (reportId: number) =>
  new RegExp(`/api/access/report/${reportId}/general-access$`);

async function openShareModal(page: Page) {
  await page.getByTestId('report-share-btn').click();
  const modal = page.getByTestId('share-modal');
  await expect(modal).toBeVisible();
  return modal;
}

test.describe('report sharing — gaps', () => {
  // Shared staging backend under parallel load: these multi-request flows need the 3x budget
  test.slow();

  test('GAP-R add people to a report through the Share modal (grant intercepted)', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const memberEmail = ROLE_USERS.member.email;
    test.skip(!memberEmail, 'no E2E_MEMBER_EMAIL in .env');
    const dash = await createReportDashboard(api, factory, { name: 'gaps-share-people' });
    const report = await createReport(api, track, {
      name: 'gaps-share-people-rep',
      dashboardId: dash.dashboardId,
    });
    const memberId = await orgUserId(api, memberEmail!);
    // A real grant notifies (emails) the recipient → answer the POST ourselves
    await page.route(GRANTS_URL(report.id), (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 200, json: { shares: [], warnings: [] } })
        : route.fallback()
    );
    await openReport(page, report.id);
    // An email typed before the org's members have loaded is staged as an outside invite
    const membersLoaded = page.waitForResponse(
      (r) =>
        r.request().method() === 'GET' && /\/api\/v1\/organizations\/active-members$/.test(r.url())
    );
    const modal = await openShareModal(page);
    await membersLoaded;
    await expect(page.getByTestId('share-submit-btn')).toBeDisabled();

    const input = page.getByTestId('share-chip-input');
    await input.fill(memberEmail!.toLowerCase());
    await input.press('Enter');
    // Resolved to the org user (a user chip, not an invite)
    await expect(modal.getByText(memberEmail!.toLowerCase(), { exact: true })).toBeVisible();
    await expect(modal.getByText(/isn't on Dalgo yet/)).toHaveCount(0);
    await expect(page.getByTestId('share-submit-btn')).toBeEnabled();

    // Staged chip: bump View → Edit before sharing
    const chipLevel = page.getByTestId(`share-chip-level-user:${memberId}`);
    await expect(chipLevel).toHaveText('View');
    await chipLevel.click();
    await page.getByTestId(`share-chip-level-user:${memberId}-option-edit`).click();
    await expect(chipLevel).toHaveText('Edit');

    const grant = captureRequest(page, { method: 'POST', url: GRANTS_URL(report.id) });
    await page.getByTestId('share-submit-btn').click();
    const body = await grant;
    expect(body.body).toMatchObject({
      principals: [{ principal_type: 'user', principal_id: memberId, access_level: 'edit' }],
    });
    expectPayloadSnapshot(
      withStableIds(body, { [memberId]: 'member' }),
      'gaps-report-grant-member-edit'
    );
    await expect(toast(page, 'Sharing updated')).toBeVisible();
    await expect(modal).toBeHidden();
  });

  test('[pinned] GAP-R report Public option is not limited by the source dashboard sharing', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'gaps-share-parent' });
    const report = await createReport(api, track, {
      name: 'gaps-share-parent-rep',
      dashboardId: dash.dashboardId,
    });
    // Source dashboard made Private (own e2e dashboard)
    await api.patch(`/api/access/dashboard/${dash.dashboardId}/general-access`, {
      mode: 'private',
    });

    await openReport(page, report.id);
    await openShareModal(page);
    await page.getByTestId('general-access-select').click();
    // Pinned: parent_blocks are only computed for charts/KPIs (access_api._get_parent_dashboards);
    // a report is a frozen snapshot, so its source dashboard's visibility never restricts it
    await expect(page.getByTestId('general-access-option-internal')).toBeEnabled();
    await expect(page.getByTestId('general-access-option-private')).toBeEnabled();
    await expect(page.getByTestId('general-access-option-public')).toBeEnabled();
    await expect(page.getByTestId('general-access-restricted-text')).toHaveCount(0);

    const patch = captureRequest(page, { method: 'PATCH', url: GENERAL_ACCESS_URL(report.id) });
    await page.getByTestId('general-access-option-public').click();
    expectPayloadSnapshot(await patch, 'gaps-report-general-access-public-private-source');
    await expect(toast(page, `${report.title} is now public`)).toBeVisible();
    await expect(page.getByTestId('copy-link-btn')).toBeVisible();
  });

  test('GAP-R report Public option disabled when the org turns public sharing off (mocked)', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'gaps-share-orgoff' });
    const report = await createReport(api, track, {
      name: 'gaps-share-orgoff-rep',
      dashboardId: dash.dashboardId,
    });
    // The org preference is shared by every spec → flip it in the response only
    await page.route(GRANTS_URL(report.id), async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const res = await fetchForRewrite(route);
      if (!res) return;
      const body = (await res.json()) as { general_access: Record<string, unknown> };
      body.general_access.allow_public_sharing = false;
      await route.fulfill({ response: res, json: body });
    });
    const patches: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'PATCH' && GENERAL_ACCESS_URL(report.id).test(r.url()))
        patches.push(r.url());
    });
    await openReport(page, report.id);
    await openShareModal(page);
    await page.getByTestId('general-access-select').click();
    await expect(page.getByTestId('general-access-option-private')).toBeEnabled();
    await expect(page.getByTestId('general-access-option-public')).toBeDisabled();
    await page.getByTestId('general-access-option-public').click({ force: true });
    // Nothing sent, still Default
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('general-access-select')).toHaveText('Default');
    expect(patches).toHaveLength(0);
  });
});
