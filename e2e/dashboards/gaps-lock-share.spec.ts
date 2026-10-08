import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { BACKEND_URL, ROLE_USERS } from '../support/env';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { openView, makePublic, relabel, setGeneralAccess } from './helpers-view';
import { openBuilder, saveAndCapture } from './helpers-builder';
import {
  grant,
  hideTab,
  hitPublicDashboard,
  orgUserId,
  rewriteJson,
  roleApi,
  showTab,
  toasts,
} from './helpers-gaps-view';
import { fetchForRewrite } from '../support/routes';

/**
 * GAP-D — "Edit lock", "Sharing a dashboard" and "Permissions and roles" rows of
 * coverage/FEATURES.md that had no test yet. Always on e2e dashboards; the member / analyst
 * sessions come from global.setup (`pageAs` skips when their creds are missing).
 */

// Builder refreshes its lock every 60s (half the 2-minute lock); jump a little past it
const PAST_LOCK_REFRESH = '01:05';
const INVITEE_EMAIL = 'e2e-invitee@example.com';

const detailGet = (id: number) => (r: { url(): string; request(): { method(): string } }) =>
  r.url().endsWith(`/api/dashboards/${id}/`) && r.request().method() === 'GET';

async function openShareModal(page: Page) {
  await page.getByTestId('dashboard-share-btn').click();
  const modal = page.getByTestId('share-modal');
  await expect(modal).toBeVisible();
  await expect(page.getByTestId('general-access-select')).toBeVisible();
  return modal;
}

/** Share row of a person, plus its share id (from the row testid). */
async function grantRow(page: Page, email: string) {
  const row = page.locator('[data-testid^="share-grant-row-"]').filter({ hasText: email });
  await expect(row).toBeVisible();
  const testId = (await row.getAttribute('data-testid'))!;
  return { row, shareId: testId.replace('share-grant-row-', '') };
}

test.describe('GAP-D edit lock', () => {
  test('GAP-D locked screen: "Refresh Now" rechecks; opens the builder once the other user leaves', async ({
    page,
    factory,
    pageAs,
  }) => {
    await pageAs('analyst'); // skips without analyst creds
    const dash = await factory.dashboard('gap-l-refresh-now');
    const analyst = await roleApi('analyst');
    try {
      await analyst.post(`/api/dashboards/${dash.id}/lock/`, {});
      await page.goto(`/dashboards/${dash.id}/edit`);
      await expect(page.getByTestId('dashboard-locked-title')).toHaveText(
        'Dashboard is Currently Locked',
        {
          timeout: 30_000,
        }
      );
      await expect(
        page.getByText(`Currently edited by: ${ROLE_USERS.analyst.email}`)
      ).toBeVisible();

      // Still locked: Refresh Now refetches and keeps the locked screen
      const stillLocked = page.waitForResponse(detailGet(dash.id));
      await page.getByTestId('dashboard-locked-refresh-btn').click();
      expect(((await (await stillLocked).json()) as { is_locked: boolean }).is_locked).toBe(true);
      await expect(page.getByTestId('dashboard-locked-title')).toBeVisible();

      // The analyst leaves → Refresh Now drops the locked screen and mounts the builder
      await analyst.delete(`/api/dashboards/${dash.id}/lock/`);
      const released = page.waitForResponse(detailGet(dash.id));
      const lock = page.waitForRequest(
        (r) => r.method() === 'POST' && r.url().endsWith(`/api/dashboards/${dash.id}/lock/`)
      );
      await page.getByTestId('dashboard-locked-refresh-btn').click();
      expect(((await (await released).json()) as { is_locked: boolean }).is_locked).toBe(false);
      await expect(page.getByTestId('dashboard-locked-title')).toHaveCount(0);
      await expect(page.getByTestId('add-chart-btn')).toBeVisible({ timeout: 30_000 });
      await lock;
    } finally {
      await analyst.delete(`/api/dashboards/${dash.id}/lock/`).catch(() => {});
      await analyst.dispose();
    }
  });

  test('GAP-D the builder refreshes its edit lock every 60 seconds', async ({ page, factory }) => {
    const dash = await factory.dashboard('gap-l-refresh-60s');
    await page.clock.install();
    await openBuilder(page, dash.id);

    const refreshUrl = `/api/dashboards/${dash.id}/lock/refresh/`;
    const refresh = captureRequest(page, { method: 'PUT', url: refreshUrl, timeout: 30_000 });
    let refreshed = false;
    page.on('request', (r) => {
      if (r.method() === 'PUT' && r.url().endsWith(refreshUrl)) refreshed = true;
    });
    // The interval starts once the lock response is handled; if a jump lands before that, the
    // interval counts from the new time — so keep jumping until the refresh goes out
    await expect
      .poll(async () => {
        await page.clock.fastForward(PAST_LOCK_REFRESH);
        return refreshed;
      })
      .toBe(true);
    expectPayloadSnapshot(await refresh, 'gap-lock-refresh');
  });

  test('GAP-D a "locked" (423) answer to the lock request alerts and returns to /dashboards', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-l-423');
    await page.route(`**/api/dashboards/${dash.id}/lock/`, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 423, json: { detail: 'Dashboard is locked by someone else' } })
        : route.fallback()
    );
    const lock = captureRequest(page, { method: 'POST', url: `/api/dashboards/${dash.id}/lock/` });
    const dialog = page.waitForEvent('dialog');
    await page.goto(`/dashboards/${dash.id}/edit`);
    expectPayloadSnapshot(await lock, 'gap-lock-post-423');

    const alert = await dialog;
    expect(alert.type()).toBe('alert');
    expect(alert.message()).toBe(
      'This dashboard is currently being edited by another user: Dashboard is locked by someone else'
    );
    await alert.accept();
    await expect(page).toHaveURL('/dashboards');
  });

  // Bug pinned: hiding the tab fires two unlocks — the edit page's (to the backend, works) and the
  // builder's keepalive fetch to a RELATIVE url, which hits the Next server instead of the API.
  // Nothing re-takes the lock when the tab becomes visible again.
  test('[pinned] GAP-D hiding the tab releases the lock (plus a stray unlock to the Next server)', async ({
    page,
    api,
    factory,
    baseURL,
  }) => {
    const dash = await factory.dashboard('gap-l-hidden');
    await openBuilder(page, dash.id);
    const lockState = async () =>
      (await api.get<{ is_locked: boolean }>(`/api/dashboards/${dash.id}/`)).is_locked;
    expect(await lockState()).toBe(true);

    const isUnlock = (url: string) => (r: { method(): string; url(): string }) =>
      r.method() === 'DELETE' && r.url() === url;
    const backendUnlock = page.waitForRequest(
      isUnlock(`${BACKEND_URL}/api/dashboards/${dash.id}/lock/`)
    );
    const strayUnlock = page.waitForRequest(
      isUnlock(`${new URL(baseURL!).origin}/api/dashboards/${dash.id}/lock/`)
    );
    await hideTab(page);
    await Promise.all([backendUnlock, strayUnlock]);
    await expect.poll(lockState).toBe(false);

    const relocks: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith(`/api/dashboards/${dash.id}/lock/`))
        relocks.push(r.url());
    });
    await showTab(page);
    // Any re-lock would be sent from the visibilitychange handler — before this explicit Save
    await saveAndCapture(page, dash.id);
    expect(relocks).toEqual([]);
    expect(await lockState()).toBe(false);
  });
});

test.describe('GAP-D sharing a dashboard', () => {
  test('GAP-D change a member between View and Edit (cascade confirm, PATCH, effect on the member) @sends-email', async ({
    page,
    api,
    factory,
    pageAs,
  }) => {
    const member = await pageAs('member');
    const memberEmail = ROLE_USERS.member.email!.toLowerCase();
    const dash = await factory.dashboard('gap-s-level');
    await setGeneralAccess(dash.id, 'private');
    await grant(api, dash.id, await orgUserId(api, memberEmail), 'view');

    await openView(page, dash.id);
    await openShareModal(page);
    const { shareId } = await grantRow(page, memberEmail);
    const level = page.getByTestId(`share-grant-level-${shareId}`);
    await expect(level).toHaveText('View');

    const setLevel = async (to: 'view' | 'edit') => {
      await level.click();
      await page.getByTestId(`share-grant-level-${shareId}-option-${to}`).click();
      // Dashboards confirm level changes because they cascade to the charts inside
      await expect(page.getByTestId('share-cascade-dialog')).toBeVisible();
      const patch = captureRequest(page, {
        method: 'PATCH',
        url: `/api/access/dashboard/${dash.id}/grants/${shareId}`,
      });
      await page.getByTestId('share-cascade-continue-btn').click();
      const captured = await patch;
      await expect(page.getByText(`Access updated to ${to}`)).toBeVisible();
      return captured;
    };

    expectPayloadSnapshot(
      relabel(await setLevel('edit'), { [shareId]: '<share>' }),
      'gap-grant-level-edit'
    );
    await expect(level).toHaveText('Edit');
    await openView(member, dash.id);
    await expect(member.getByTestId('dashboard-edit-btn')).toBeVisible();

    expectPayloadSnapshot(
      relabel(await setLevel('view'), { [shareId]: '<share>' }),
      'gap-grant-level-view'
    );
    await expect(level).toHaveText('View');
    await openView(member, dash.id);
    await expect(member.getByTestId('request-edit-pill').locator('visible=true')).toBeVisible();
    await expect(member.getByTestId('dashboard-edit-btn')).toHaveCount(0);
  });

  test('GAP-D member requests access from the no-access screen; the owner approves @sends-email', async ({
    page,
    factory,
    pageAs,
  }) => {
    const member = await pageAs('member');
    const memberEmail = ROLE_USERS.member.email!.toLowerCase();
    const dash = await factory.dashboard('gap-s-approve');
    await setGeneralAccess(dash.id, 'private');

    await member.goto(`/dashboards/${dash.id}`);
    await expect(member.getByTestId('no-access')).toBeVisible({ timeout: 30_000 });
    await member.getByRole('button', { name: 'Request Access' }).click();
    const dialog = member.getByTestId('request-access-dialog');
    await expect(dialog).toBeVisible();
    await expect(member.getByTestId('request-access-level')).toHaveText('View');
    await member.getByTestId('request-access-note').fill('e2e: need this for the review');
    const request = captureRequest(member, {
      method: 'POST',
      url: `/api/access/dashboard/${dash.id}/request-access`,
    });
    await member.getByTestId('request-access-send-btn').click();
    expectPayloadSnapshot(await request, 'gap-request-access-view');
    await expect(dialog).toBeHidden();
    await expect(
      member.getByText('Your access request has been sent. The owner will review it.')
    ).toBeVisible();
    await expect(member.getByRole('button', { name: 'Request Access' })).toHaveCount(0);

    await openView(page, dash.id);
    await openShareModal(page);
    const row = page
      .locator('[data-testid^="access-request-row-"]')
      .filter({ hasText: memberEmail });
    await expect(row).toContainText(`${memberEmail} wants to view — e2e: need this for the review`);
    const requestId = (await row.getAttribute('data-testid'))!.replace('access-request-row-', '');
    const respond = captureRequest(page, {
      method: 'POST',
      url: `/api/access/dashboard/${dash.id}/request-access/${requestId}/respond`,
    });
    await page.getByTestId(`access-request-approve-${requestId}`).click();
    expectPayloadSnapshot(
      relabel(await respond, { [requestId]: '<request>' }),
      'gap-request-access-approve'
    );
    await expect(page.getByText('Request approved')).toBeVisible();
    await expect(row).toHaveCount(0);
    await grantRow(page, memberEmail);

    await openView(member, dash.id);
    await expect(member.getByTestId('no-access')).toHaveCount(0);
    await expect(member.getByTestId('request-edit-pill').locator('visible=true')).toBeVisible();
  });

  test('GAP-D member sends Request Edit from a view-only dashboard; the owner denies @sends-email', async ({
    page,
    factory,
    pageAs,
  }) => {
    const member = await pageAs('member');
    const memberEmail = ROLE_USERS.member.email!.toLowerCase();
    const dash = await factory.dashboard('gap-s-deny');

    await openView(member, dash.id);
    const pill = member.getByTestId('request-edit-pill').locator('visible=true');
    await expect(pill).toHaveText('Request Edit');
    await pill.click();
    // The pill's dialog can only ask for Edit
    await expect(member.getByTestId('request-access-level')).toHaveText('Edit');
    await expect(member.getByTestId('request-access-level')).toBeDisabled();
    const request = captureRequest(member, {
      method: 'POST',
      url: `/api/access/dashboard/${dash.id}/request-access`,
    });
    await member.getByTestId('request-access-send-btn').click();
    expectPayloadSnapshot(await request, 'gap-request-access-edit');
    await expect(pill).toHaveText('Request Edit sent');
    await expect(pill).toBeDisabled();

    await openView(page, dash.id);
    await openShareModal(page);
    const row = page
      .locator('[data-testid^="access-request-row-"]')
      .filter({ hasText: memberEmail });
    await expect(row).toContainText(`${memberEmail} wants to edit`);
    const requestId = (await row.getAttribute('data-testid'))!.replace('access-request-row-', '');
    const respond = captureRequest(page, {
      method: 'POST',
      url: `/api/access/dashboard/${dash.id}/request-access/${requestId}/respond`,
    });
    await page.getByTestId(`access-request-deny-${requestId}`).click();
    expectPayloadSnapshot(
      relabel(await respond, { [requestId]: '<request>' }),
      'gap-request-access-deny'
    );
    await expect(page.getByText('Request declined')).toBeVisible();
    await expect(row).toHaveCount(0);
    await expect(
      page.locator('[data-testid^="share-grant-row-"]').filter({ hasText: memberEmail })
    ).toHaveCount(0);

    await openView(member, dash.id);
    await expect(member.getByTestId('dashboard-edit-btn')).toHaveCount(0);
    await expect(member.getByTestId('request-edit-pill').locator('visible=true')).toHaveText(
      'Request Edit'
    );
  });

  test('GAP-D transfer ownership to an editor, then admin takeover back @sends-email', async ({
    page,
    api,
    factory,
    pageAs,
  }) => {
    await pageAs('analyst'); // skips without analyst creds
    const analystEmail = ROLE_USERS.analyst.email!.toLowerCase();
    const adminEmail = ROLE_USERS.admin.email!.toLowerCase();
    const analystId = await orgUserId(api, analystEmail);
    const adminId = await orgUserId(api, adminEmail);
    const dash = await factory.dashboard('gap-s-transfer');
    await grant(api, dash.id, analystId, 'edit');
    const labels = { [analystId]: '<analyst>', [adminId]: '<admin>' };

    try {
      await openView(page, dash.id);
      await openShareModal(page);
      const owner = page.getByTestId('share-owner-row');
      await expect(owner).toContainText(adminEmail);
      await expect(page.getByTestId('admin-takeover-btn')).toHaveCount(0);

      const { shareId } = await grantRow(page, analystEmail);
      await page.getByTestId(`share-grant-level-${shareId}`).click();
      await page.getByTestId(`share-grant-level-${shareId}-option-transfer`).click();
      const transferDialog = page.getByTestId('share-transfer-dialog');
      await expect(transferDialog).toContainText(`Transfer ownership to ${analystEmail}?`);
      const transfer = captureRequest(page, {
        method: 'POST',
        url: `/api/access/dashboard/${dash.id}/transfer-ownership`,
      });
      await page.getByTestId('share-transfer-confirm-btn').click();
      expectPayloadSnapshot(relabel(await transfer, labels), 'gap-transfer-ownership');
      await expect(page.getByText('Ownership transferred')).toBeVisible();
      await expect(owner).toContainText(analystEmail);

      // Admin, no longer the owner → can take ownership back
      await page.getByTestId('admin-takeover-btn').click();
      await expect(page.getByTestId('admin-takeover-dialog')).toBeVisible();
      const takeover = captureRequest(page, {
        method: 'POST',
        url: `/api/access/dashboard/${dash.id}/transfer-ownership`,
      });
      await page.getByTestId('admin-takeover-confirm-btn').click();
      expectPayloadSnapshot(relabel(await takeover, labels), 'gap-admin-takeover');
      await expect(owner).toContainText(adminEmail);
      await expect(page.getByTestId('admin-takeover-btn')).toHaveCount(0);
    } finally {
      // Never leave an e2e dashboard owned by the analyst (teardown sweeps as admin)
      const grants = await api.get<{ owner?: { email: string } }>(
        `/api/access/dashboard/${dash.id}/grants`
      );
      if (grants.owner?.email.toLowerCase() !== adminEmail) {
        await api.post(`/api/access/dashboard/${dash.id}/transfer-ownership`, {
          to_orguser_id: adminId,
          strip_previous_owner_access: true,
        });
      }
    }
  });

  // "Choose a role for new invites" is unreachable here: the picker preselects the org's Member role
  test('GAP-D invite by email: admins get a role picker (Member preselected); the share carries it', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-s-invite');
    await openView(page, dash.id);
    const modal = await openShareModal(page);

    const input = page.getByTestId('share-chip-input');
    await input.fill(INVITEE_EMAIL);
    await input.press('Enter');
    await expect(modal.getByText(`${INVITEE_EMAIL} isn't on Dalgo yet.`)).toBeVisible();
    await expect(modal.getByText('Choose a role for new invites before sharing.')).toBeVisible();
    const role = page.getByTestId('share-invite-role');
    await expect(role).toHaveText('Member');

    await role.click();
    // TODO testid: role options carry the role uuid only; pick them by visible name
    const options = page.locator('[data-testid^="share-invite-role-option-"]');
    await expect(options.filter({ hasText: /^Member$/ })).toHaveCount(1);
    const analystOption = options.filter({ hasText: /^Analyst$/ });
    const roleUuid = (await analystOption.getAttribute('data-testid'))!.replace(
      'share-invite-role-option-',
      ''
    );
    await analystOption.click();
    await expect(role).toHaveText('Analyst');

    // Never send a real invitation email: answer the share request ourselves
    await page.route(`**/api/access/dashboard/${dash.id}/grants`, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ json: { shares: [], warnings: [] } })
        : route.fallback()
    );
    const share = captureRequest(page, {
      method: 'POST',
      url: `/api/access/dashboard/${dash.id}/grants`,
    });
    await page.getByTestId('share-submit-btn').click();
    expectPayloadSnapshot(
      relabel(await share, { [roleUuid]: '<analyst-role>' }),
      'gap-invite-with-role'
    );
    await expect(modal).toBeHidden();
  });

  test('GAP-D invite by email as a non-admin: no role picker, "invited as Member" @sends-email', async ({
    api,
    factory,
    pageAs,
  }) => {
    const member = await pageAs('member');
    const memberEmail = ROLE_USERS.member.email!.toLowerCase();
    const dash = await factory.dashboard('gap-s-invite-member');
    await grant(api, dash.id, await orgUserId(api, memberEmail), 'edit');

    await openView(member, dash.id);
    const modal = await openShareModal(member);
    const input = member.getByTestId('share-chip-input');
    await input.fill(INVITEE_EMAIL);
    await input.press('Enter');
    await expect(modal.getByText(`${INVITEE_EMAIL} isn't on Dalgo yet.`)).toBeVisible();
    await expect(modal).toContainText('They will be invited as Member.');
    await expect(member.getByTestId('share-invite-role')).toHaveCount(0);
  });

  test('GAP-D Public option disabled when the org turned public sharing off', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-s-public-off');
    // Org-wide setting — not changed on staging; the grants response carries it
    await rewriteJson(page, `**/api/access/dashboard/${dash.id}/grants`, (json) => ({
      ...json,
      general_access: { ...(json.general_access as object), allow_public_sharing: false },
    }));
    await openView(page, dash.id);
    await openShareModal(page);
    await page.getByTestId('general-access-select').click();
    await expect(page.getByTestId('general-access-option-public')).toBeDisabled();
    await expect(page.getByTestId('general-access-option-private')).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('general-access-select')).toHaveText('Default');
  });

  test('GAP-D already-public dashboard with public sharing off: explains why, no public link', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-s-public-off-public');
    await makePublic(dash.id);
    await rewriteJson(page, `**/api/access/dashboard/${dash.id}/grants`, (json) => ({
      ...json,
      general_access: { ...(json.general_access as object), allow_public_sharing: false },
    }));
    await openView(page, dash.id);
    await openShareModal(page);
    await expect(page.getByTestId('general-access-select')).toHaveText('Public');
    await expect(page.getByTestId('general-access-description')).toHaveText(
      'Public sharing is turned off by your admin'
    );
    await expect(page.getByTestId('public-security-notice')).toHaveCount(0);
    await expect(page.getByTestId('copy-link-btn')).toHaveCount(0);
  });

  test('GAP-D public access stats: count and last accessed after a public visit', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-s-public-stats');
    const token = await makePublic(dash.id);
    await openView(page, dash.id);
    await openShareModal(page);
    await expect(page.getByTestId('copy-link-btn')).toBeVisible();
    await expect(page.getByTestId('public-access-stats')).toHaveCount(0);
    await page.getByTestId('share-close-btn').click();

    await hitPublicDashboard(token);
    await openView(page, dash.id);
    await openShareModal(page);
    await expect(page.getByTestId('public-access-count')).toHaveText('Public access count: 1');
    await expect(page.getByTestId('public-last-accessed')).toHaveText(/^Last accessed: \S.+$/);
  });
});

test.describe('GAP-D permissions and roles', () => {
  test('GAP-D "Access Denied" without the view-dashboards permission (no dashboard request)', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('gap-p-denied');
    // No staging role lacks can_view_dashboards; drop it from the permissions the app receives
    await page.route('**/api/currentuserv2', async (route) => {
      const res = await fetchForRewrite(route);
      if (!res) return;
      const orgUsers = (await res.json()) as Array<{ permissions: Array<{ slug: string }> }>;
      await route.fulfill({
        response: res,
        json: orgUsers.map((ou) => ({
          ...ou,
          permissions: ou.permissions.filter((p) => p.slug !== 'can_view_dashboards'),
        })),
      });
    });
    const detailRequests: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith(`/api/dashboards/${dash.id}/`)) detailRequests.push(r.url());
    });
    await page.goto(`/dashboards/${dash.id}`);
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("You don't have permission to view dashboards.")).toBeVisible();
    expect(detailRequests).toEqual([]);
    await expect(toasts(page)).toHaveCount(0);
    await page.getByTestId('dashboard-view-access-denied-back-btn').click();
    await expect(page).toHaveURL('/dashboards');
  });
});
