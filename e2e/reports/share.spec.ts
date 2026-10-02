import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import type { ApiClient } from '../support/api-client';
import { ROLE_USERS } from '../support/env';
import {
  createReport,
  createReportDashboard,
  dismissFeatureNudges,
  openReport,
  setListFilter,
  setReportGeneralAccess,
  toast,
  waitForListQuery,
} from './helpers';

const GENERAL_ACCESS_URL = /\/api\/access\/report\/\d+\/general-access$/;
const REQUEST_ACCESS_URL = /\/api\/access\/report\/\d+\/request-access$/;

async function setGeneralAccess(page: Page, mode: 'internal' | 'private' | 'public') {
  await page.getByTestId('general-access-select').click();
  await page.getByTestId(`general-access-option-${mode}`).click();
}

/**
 * Admin grants `email` View on the report and makes it Private, so that user's ONLY access is
 * the View grant (Default mode would give them their role's floor access). Done through the API:
 * the share-modal UI itself is covered in R-S1.
 */
async function shareViewOnly(api: ApiClient, reportId: number, email: string) {
  const people = await api.get<Array<{ email: string; orguser_id: number }>>(
    '/api/v1/organizations/people'
  );
  const person = people.find((p) => p.email === email);
  if (!person) throw new Error(`${email} is not a member of the e2e org`);
  await api.post(`/api/access/report/${reportId}/grants`, {
    principals: [{ principal_type: 'user', principal_id: person.orguser_id, access_level: 'view' }],
  });
  await setReportGeneralAccess(reportId, 'private');
}

test.describe('report share modal (own report)', () => {
  test('[pinned] R-S1 share modal: general access Private → Public → copy link → Default', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'share-modal' });
    const report = await createReport(api, track, {
      name: 'share-modal-rep',
      dashboardId: dash.dashboardId,
    });
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await openReport(page, report.id);

    await page.getByTestId('report-share-btn').click();
    const modal = page.getByTestId('share-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: `Share "${report.title}"` })).toBeVisible();
    // The "inner charts inherit" note is dashboard-only
    await expect(modal).not.toContainText(
      'All inner charts and KPIs will inherit this permission.'
    );
    await expect(page.getByTestId('share-owner-row')).toBeVisible();
    await expect(page.getByTestId('share-submit-btn')).toBeDisabled();
    await expect(page.getByTestId('general-access-select')).toHaveText('Default');
    await expect(page.getByTestId('general-access-description')).toHaveText(
      'Users can access this resource based on their role permissions'
    );

    // Private
    let patch = captureRequest(page, { method: 'PATCH', url: GENERAL_ACCESS_URL });
    await setGeneralAccess(page, 'private');
    expectPayloadSnapshot(await patch, 'report-general-access-private');
    await expect(toast(page, `${report.title} is now private`)).toBeVisible();
    await expect(page.getByTestId('general-access-description')).toHaveText(
      'Only direct shares can access this resource'
    );
    await expect(page.getByTestId('public-security-notice')).toHaveCount(0);

    // Public → security notice + copy link
    patch = captureRequest(page, { method: 'PATCH', url: GENERAL_ACCESS_URL });
    await setGeneralAccess(page, 'public');
    expectPayloadSnapshot(await patch, 'report-general-access-public');
    await expect(toast(page, `${report.title} is now public`)).toBeVisible();
    await expect(page.getByTestId('public-security-notice')).toContainText(
      // Pinned: the notice interpolates the lowercased entity LABEL (the report title), not "report"
      `Anyone with this link can access your ${report.title.toLowerCase()} data without authentication.`
    );
    await page.getByTestId('copy-link-btn').click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toMatch(/\/share\/report\/[\w-]+$/);

    // Back to Default
    patch = captureRequest(page, { method: 'PATCH', url: GENERAL_ACCESS_URL });
    await setGeneralAccess(page, 'internal');
    expectPayloadSnapshot(await patch, 'report-general-access-internal');
    await expect(
      toast(page, `${report.title} is now visible to everyone in your org`)
    ).toBeVisible();
    await expect(page.getByTestId('copy-link-btn')).toHaveCount(0);

    await page.getByTestId('share-close-btn').click();
    await expect(modal).toBeHidden();
  });

  test('R-S1 list row share icon opens the same modal', async ({ page, api, track, factory }) => {
    await dismissFeatureNudges(page);
    const dash = await createReportDashboard(api, factory, { name: 'share-row' });
    const report = await createReport(api, track, {
      name: 'share-row-rep',
      dashboardId: dash.dashboardId,
    });
    await page.goto('/reports');
    const loaded = waitForListQuery(page, 'search', report.title);
    await setListFilter(page, 'title', report.title);
    await loaded;

    await page.getByTestId(`report-share-${report.id}`).click();
    await expect(page.getByTestId('share-modal')).toBeVisible();
    await expect(page.getByTestId('share-modal')).toContainText(`Share "${report.title}"`);
    // Row click did not navigate (actions cell stops propagation)
    await expect(page).toHaveURL(/\/reports$/);
    await page.getByTestId('share-close-btn').click();
    await expect(page.getByTestId('share-modal')).toBeHidden();
  });
});

test.describe('report permissions (second user)', () => {
  test('view-only member: no edit/share UI; Request Edit pill (intercepted) @sends-email', async ({
    pageAs,
    api,
    track,
    factory,
  }) => {
    // Skips here when E2E_MEMBER_* is not configured
    const member = await pageAs('member');
    const dash = await createReportDashboard(api, factory, { name: 'perm-view' });
    const report = await createReport(api, track, {
      name: 'perm-view-rep',
      dashboardId: dash.dashboardId,
    });
    await shareViewOnly(api, report.id, ROLE_USERS.member.email!);

    await openReport(member, report.id);
    await expect(member.getByTestId('report-download-btn')).toBeVisible();
    await expect(member.getByTestId('report-share-btn')).toHaveCount(0);
    await expect(member.getByTestId('report-email-pdf-btn')).toHaveCount(0);
    await expect(member.getByTestId('summary-edit-btn')).toHaveCount(0);
    // Summary comments are editor-only; chart comments are open to every viewer
    await expect(member.getByTestId('comment-trigger-summary')).toHaveCount(0);
    await expect(member.getByTestId(`comment-trigger-chart-${dash.chartId}`)).toBeVisible();

    // Request Edit → dialog locked to Edit → send (intercepted: it notifies the owner)
    await member.route(REQUEST_ACCESS_URL, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 200, json: { success: true } })
        : route.continue()
    );
    const pill = member.getByTestId('request-edit-pill');
    await expect(pill).toHaveText('Request Edit');
    await pill.click();
    await expect(member.getByTestId('request-access-dialog')).toBeVisible();
    await expect(member.getByTestId('request-access-level')).toBeDisabled();
    await expect(member.getByTestId('request-access-level')).toHaveText('Edit');
    await member.getByTestId('request-access-note').fill('Need to update the summary');
    const req = captureRequest(member, { method: 'POST', url: REQUEST_ACCESS_URL });
    await member.getByTestId('request-access-send-btn').click();
    expectPayloadSnapshot(await req, 'report-request-edit');
    await expect(pill).toHaveText('Request Edit sent');
    await expect(pill).toBeDisabled();
  });

  test('comment moderation: editor can delete (not edit) a viewer comment → placeholder @sends-email', async ({
    page,
    pageAs,
    api,
    track,
    factory,
  }) => {
    const member = await pageAs('member');
    const dash = await createReportDashboard(api, factory, { name: 'perm-moderate' });
    const report = await createReport(api, track, {
      name: 'perm-moderate-rep',
      dashboardId: dash.dashboardId,
    });
    await shareViewOnly(api, report.id, ROLE_USERS.member.email!);

    // Admin comments first so the thread still has a live comment after moderation
    await openReport(page, report.id);
    await page.getByTestId(`comment-trigger-chart-${dash.chartId}`).click();
    await page.getByTestId('comment-input').fill('Editor note');
    await page.getByTestId('comment-input').press('Enter');
    await expect(page.getByText('Editor note')).toBeVisible();

    // Member comments on the chart
    await openReport(member, report.id);
    await member.getByTestId(`comment-trigger-chart-${dash.chartId}`).click();
    const created = member.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/comments\/$/.test(r.url())
    );
    await member.getByTestId('comment-input').fill('Viewer question');
    await member.getByTestId('comment-input').press('Enter');
    const memberCommentId = ((await (await created).json()) as { data: { id: number } }).data.id;

    // Admin (report Edit = moderator) sees Delete but not Edit on it
    await openReport(page, report.id);
    await page.getByTestId(`comment-trigger-chart-${dash.chartId}`).click();
    await page.getByTestId(`comment-${memberCommentId}`).hover();
    await page.getByTestId(`comment-menu-${memberCommentId}`).click();
    await expect(page.getByTestId(`edit-btn-${memberCommentId}`)).toHaveCount(0);
    await page.getByTestId(`delete-btn-${memberCommentId}`).click();
    await page.getByTestId(`confirm-delete-btn-${memberCommentId}`).click();
    // Thread has another author → soft delete → placeholder
    await expect(page.getByTestId(`comment-${memberCommentId}-deleted-text`)).toHaveText(
      'This message was deleted'
    );
  });
});
