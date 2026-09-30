import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { ROLE_USERS } from '../support/env';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { openView, relabel } from './helpers-view';

/**
 * MATRIX §2.6 Share (authenticated half): D-S1 general access + copy link, D-S6 people grants.
 * Logged-out public views live in share-dashboard.public.spec.ts.
 * Always on an e2e dashboard — never re-share seed objects.
 */

async function openShareModal(page: Page) {
  await page.getByTestId('dashboard-share-btn').click();
  const modal = page.getByTestId('share-modal');
  await expect(modal).toBeVisible();
  await expect(page.getByTestId('general-access-select')).toBeVisible();
  return modal;
}

async function chooseMode(
  page: Page,
  dashboardId: number,
  option: 'internal' | 'private' | 'public'
) {
  const req = captureRequest(page, {
    method: 'PATCH',
    url: `/api/access/dashboard/${dashboardId}/general-access`,
  });
  await page.getByTestId('general-access-select').click();
  await page.getByTestId(`general-access-option-${option}`).click();
  return req;
}

test.describe('dashboard share — general access', () => {
  test('D-S1 general access Default → Private → Public, copy public link, back to Default', async ({
    page,
    context,
    factory,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const dash = await factory.dashboard('s1-share');
    await openView(page, dash.id);
    await openShareModal(page);

    const select = page.getByTestId('general-access-select');
    const description = page.getByTestId('general-access-description');
    await expect(select).toHaveText('Default');
    await expect(description).toHaveText(
      'Users can access this resource based on their role permissions'
    );
    await expect(page.getByTestId('copy-link-btn')).toHaveCount(0);

    expectPayloadSnapshot(await chooseMode(page, dash.id, 'private'), 'general-access-private');
    await expect(select).toHaveText('Private');
    await expect(description).toHaveText('Only direct shares can access this resource');

    expectPayloadSnapshot(await chooseMode(page, dash.id, 'public'), 'general-access-public');
    await expect(select).toHaveText('Public');
    await expect(description).toHaveText(
      'Anyone on the internet with the link can access this resource'
    );
    await expect(page.getByTestId('public-security-notice')).toBeVisible();

    const copy = page.getByTestId('copy-link-btn');
    await expect(copy).toHaveText('COPY PUBLIC LINK');
    await copy.click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toMatch(/^https?:\/\/[^/]+\/share\/dashboard\/[A-Za-z0-9_-]{20,}$/);

    expectPayloadSnapshot(await chooseMode(page, dash.id, 'internal'), 'general-access-internal');
    await expect(select).toHaveText('Default');
    await expect(page.getByTestId('public-security-notice')).toHaveCount(0);
  });

  test('D-S1 ?openShare=true opens the share modal on load; closing strips the param', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('s1-deeplink');
    await page.goto(`/dashboards/${dash.id}?openShare=true`);
    await expect(page.getByTestId('share-modal')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('share-close-btn').click();
    await expect(page.getByTestId('share-modal')).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/dashboards/${dash.id}$`));
  });
});

test.describe('dashboard share — people', () => {
  test('D-S6 grant a member view access, member sees view-only, then revoke @sends-email', async ({
    page,
    pageAs,
    factory,
  }) => {
    const memberPage = await pageAs('member'); // skips when E2E_MEMBER_* is absent
    const memberEmail = ROLE_USERS.member.email!.toLowerCase();
    const dash = await factory.dashboard('s6-people');

    await openView(page, dash.id);
    const modal = await openShareModal(page);
    // Private first, so the member's only way in is the direct grant
    await chooseMode(page, dash.id, 'private');
    await expect(page.getByTestId('general-access-select')).toHaveText('Private');

    const input = page.getByTestId('share-chip-input');
    await input.fill(memberEmail);
    await input.press('Enter');
    await expect(modal.getByText(memberEmail)).toBeVisible();

    const grant = captureRequest(page, {
      method: 'POST',
      url: `/api/access/dashboard/${dash.id}/grants`,
    });
    await page.getByTestId('share-submit-btn').click();
    const granted = await grant;
    // orguser id of the member is environment-specific → label it
    const principals = (granted.body as { principals: Array<{ principal_id: number }> }).principals;
    expect(principals).toHaveLength(1);
    expectPayloadSnapshot(
      relabel(granted, { [principals[0].principal_id]: '<member>' }),
      'grant-member-view'
    );

    await openView(memberPage, dash.id);
    await expect(memberPage.getByTestId('request-edit-pill').locator('visible=true')).toBeVisible();
    await expect(memberPage.getByTestId('dashboard-edit-btn')).toHaveCount(0);

    await openView(page, dash.id);
    await openShareModal(page);
    const row = page.locator('[data-testid^="share-grant-row-"]').filter({ hasText: memberEmail });
    await expect(row).toBeVisible();
    const revoke = captureRequest(page, {
      method: 'DELETE',
      url: `/api/access/dashboard/${dash.id}/grants`,
    });
    await row.locator('[data-testid^="share-grant-remove-"]').click();
    // Dashboards confirm removal because it cascades to the charts inside
    await expect(page.getByTestId('share-cascade-dialog')).toBeVisible();
    await page.getByTestId('share-cascade-continue-btn').click();
    expectPayloadSnapshot(await revoke, 'revoke-member');
    await expect(row).toHaveCount(0);

    await memberPage.goto(`/dashboards/${dash.id}`);
    await expect(memberPage.getByTestId('no-access')).toBeVisible({ timeout: 30_000 });
  });
});
