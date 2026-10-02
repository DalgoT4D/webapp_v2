import type { Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { captureRequest, expectPayloadSnapshot } from './support/payload';
import { fetchForRewrite } from './support/routes';
import { gotoChartDetail } from './charts/helpers-core';
import { setGeneralAccess } from './dashboards/helpers-view';

/**
 * Interaction-coverage gaps (coverage/INTERACTIONS.md) in shared UI: share-modal rows, dialogs and
 * staged chips, the request-access dialog, and the generic ConfirmationDialog.
 *
 * Share-modal rows are STUBBED (GET grants / request-access rewritten) so every row kind renders on
 * an e2e object without real grants. Every mutating call they trigger — grant level PATCH, access
 * request respond (both send email), grant DELETE, upgrade POST, ownership transfer — is answered
 * by the test with route.fulfill and never reaches the backend.
 */

// Fake principals — ids far outside the staging range, reserved-domain emails (never mailable)
const DIRECT_EDIT = 990001;
const DIRECT_VIEW = 990002;
const INHERITED_NONE_USER = 990103;
const INHERITED_EDIT_USER = 990104;
const OWNER_ORGUSER = 990300;
const ACCESS_REQUEST_ID = 990201;
const OWNER_EMAIL = 'stub-owner@example.com';

interface StubShare {
  share_id: number | null;
  principal_type: 'user';
  principal_id: number;
  email: string;
  label: string;
  role_or_group: string;
  access_level: 'no_access' | 'view' | 'edit';
  status: 'active';
  cascade_sources: Array<{ dashboard_id: number; dashboard_title: string }>;
}

function share(
  shareId: number | null,
  principalId: number,
  level: StubShare['access_level'],
  name: string
): StubShare {
  return {
    share_id: shareId,
    principal_type: 'user',
    principal_id: principalId,
    email: `${name}@example.com`,
    label: `${name}@example.com`,
    role_or_group: 'Member',
    access_level: level,
    status: 'active',
    cascade_sources: shareId === null ? [{ dashboard_id: 1, dashboard_title: 'Stub dash' }] : [],
  };
}

const STUB_SHARES: StubShare[] = [
  share(DIRECT_EDIT, 990101, 'edit', 'stub-edit'),
  share(DIRECT_VIEW, 990102, 'view', 'stub-view'),
  share(null, INHERITED_NONE_USER, 'no_access', 'stub-inherited-none'),
  share(null, INHERITED_EDIT_USER, 'edit', 'stub-inherited-edit'),
];

const grantsUrl = (rtype: string, id: number) =>
  new RegExp(`/api/access/${rtype}/${id}/grants(/\\d+)?$`);

/**
 * GET grants → real general_access + stub rows, owned by someone else (so admin sees takeover).
 * Mutations on grants → fulfilled here (never reach the backend).
 */
async function stubGrants(page: Page, rtype: string, id: number, shares: StubShare[]) {
  await page.route(grantsUrl(rtype, id), async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      // SWR revalidates after each mutation; one may still be in flight when the test ends
      const res = await fetchForRewrite(route).catch((): null => null);
      if (!res) return;
      const body = (await res.json().catch((): null => null)) as Record<string, unknown> | null;
      if (!body) return;
      return route
        .fulfill({
          response: res,
          json: {
            ...body,
            shares,
            caller_is_owner: false,
            owner: { orguser_id: OWNER_ORGUSER, email: OWNER_EMAIL, role_name: 'Member' },
          },
        })
        .catch((): undefined => undefined);
    }
    if (method === 'POST') return route.fulfill({ status: 200, json: { shares, warnings: [] } });
    // PATCH (level change — would email) / DELETE (remove) of a stub row
    return route.fulfill({ status: 200, json: shares });
  });
}

async function stubTransfer(page: Page, rtype: string, id: number) {
  await page.route(new RegExp(`/api/access/${rtype}/${id}/transfer-ownership$`), (route) =>
    route.fulfill({ status: 200, json: { success: true } })
  );
}

async function openChartShare(page: Page, chartId: number) {
  await gotoChartDetail(page, chartId);
  await page.getByTestId('chart-detail-share-button').click();
  const modal = page.getByTestId('share-modal');
  await expect(modal).toBeVisible();
  await expect(page.getByTestId('general-access-select')).toBeVisible();
  return modal;
}

async function pickLevel(page: Page, trigger: string, option: string) {
  await page.getByTestId(trigger).click();
  await page.getByTestId(`${trigger}-option-${option}`).click();
}

test.describe('IG-misc share modal (stubbed rows)', () => {
  test.slow();

  test('IG-misc share grant level view/edit + remove on direct rows (PATCH/DELETE fulfilled)', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('ig-share-levels');
    await stubGrants(page, 'chart', chart.id, STUB_SHARES);
    await openChartShare(page, chart.id);

    await expect(page.getByTestId(`share-grant-level-${DIRECT_EDIT}`)).toHaveText('Edit');
    const toView = captureRequest(page, {
      method: 'PATCH',
      url: grantsUrl('chart', chart.id),
    });
    await pickLevel(page, `share-grant-level-${DIRECT_EDIT}`, 'view');
    const viewReq = await toView;
    expect(viewReq.path).toMatch(new RegExp(`/grants/${DIRECT_EDIT}$`));
    expect(viewReq.body).toEqual({ access_level: 'view' });
    expectPayloadSnapshot(viewReq, 'ig-misc-grant-level-view');
    await expect(page.getByText('Access updated to view')).toBeVisible();

    const toEdit = captureRequest(page, { method: 'PATCH', url: grantsUrl('chart', chart.id) });
    await pickLevel(page, `share-grant-level-${DIRECT_VIEW}`, 'edit');
    const editReq = await toEdit;
    expect(editReq.path).toMatch(new RegExp(`/grants/${DIRECT_VIEW}$`));
    expect(editReq.body).toEqual({ access_level: 'edit' });
    expectPayloadSnapshot(editReq, 'ig-misc-grant-level-edit');
    await expect(page.getByText('Access updated to edit')).toBeVisible();

    const remove = captureRequest(page, { method: 'DELETE', url: grantsUrl('chart', chart.id) });
    await page.getByTestId(`share-grant-remove-${DIRECT_VIEW}`).click();
    const removeReq = await remove;
    expect(removeReq.path).toMatch(new RegExp(`/grants/${DIRECT_VIEW}$`));
    expectPayloadSnapshot(removeReq, 'ig-misc-grant-remove');

    // Inherited rows can't be removed directly (share-modal.tsx: disabled when share_id is null)
    await expect(
      page.getByTestId(`share-grant-remove-inherited-user-${INHERITED_EDIT_USER}`)
    ).toBeDisabled();
  });

  test('IG-misc inherited row upgrade view/edit sends a direct grant (POST fulfilled)', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('ig-share-inherited');
    await stubGrants(page, 'chart', chart.id, STUB_SHARES);
    await openChartShare(page, chart.id);
    const trigger = `share-grant-level-inherited-user-${INHERITED_NONE_USER}`;

    for (const level of ['view', 'edit'] as const) {
      const post = captureRequest(page, { method: 'POST', url: grantsUrl('chart', chart.id) });
      await pickLevel(page, trigger, level);
      const req = await post;
      expect(req.body).toEqual({
        principals: [
          { principal_type: 'user', principal_id: INHERITED_NONE_USER, access_level: level },
        ],
      });
      expectPayloadSnapshot(req, `ig-misc-inherited-upgrade-${level}`);
      await expect(page.getByTestId(trigger)).toBeEnabled();
    }
  });

  test('IG-misc transfer ownership: cancel, then confirm (direct + inherited rows)', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('ig-share-transfer');
    await stubGrants(page, 'chart', chart.id, STUB_SHARES);
    await stubTransfer(page, 'chart', chart.id);
    await openChartShare(page, chart.id);
    const dialog = page.getByTestId('share-transfer-dialog');

    // Cancel: no request, dialog closes
    await pickLevel(page, `share-grant-level-${DIRECT_EDIT}`, 'transfer');
    await expect(dialog).toContainText('Transfer ownership to stub-edit@example.com?');
    await page.getByTestId('share-transfer-cancel-btn').click();
    await expect(dialog).toBeHidden();

    // Inherited edit row → transfer → confirm
    await pickLevel(page, `share-grant-level-inherited-user-${INHERITED_EDIT_USER}`, 'transfer');
    await expect(dialog).toContainText('stub-inherited-edit@example.com');
    const transfer = captureRequest(page, {
      method: 'POST',
      url: `/api/access/chart/${chart.id}/transfer-ownership`,
    });
    await page.getByTestId('share-transfer-confirm-btn').click();
    const req = await transfer;
    expect(req.body).toEqual({
      to_orguser_id: INHERITED_EDIT_USER,
      strip_previous_owner_access: false,
    });
    expectPayloadSnapshot(req, 'ig-misc-transfer-ownership');
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Ownership transferred')).toBeVisible();
  });

  test('IG-misc admin takeover: cancel, then confirm (POST fulfilled)', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('ig-share-takeover');
    await stubGrants(page, 'chart', chart.id, STUB_SHARES);
    await stubTransfer(page, 'chart', chart.id);
    // Takeover resolves the caller's own orguser id from the members list
    const members = page.waitForResponse((r) =>
      /\/api\/v1\/organizations\/active-members$/.test(r.url())
    );
    await openChartShare(page, chart.id);
    await members;
    const dialog = page.getByTestId('admin-takeover-dialog');

    await page.getByTestId('admin-takeover-btn').click();
    await expect(dialog).toContainText(OWNER_EMAIL);
    await page.getByTestId('admin-takeover-cancel-btn').click();
    await expect(dialog).toBeHidden();

    await page.getByTestId('admin-takeover-btn').click();
    const transfer = captureRequest(page, {
      method: 'POST',
      url: `/api/access/chart/${chart.id}/transfer-ownership`,
    });
    await page.getByTestId('admin-takeover-confirm-btn').click();
    const req = await transfer;
    expect(req.body).toMatchObject({ strip_previous_owner_access: true });
    expect(typeof (req.body as { to_orguser_id: unknown }).to_orguser_id).toBe('number');
    expectPayloadSnapshot(
      { ...req, body: { ...(req.body as object), to_orguser_id: '<self>' } },
      'ig-misc-admin-takeover'
    );
    await expect(dialog).toBeHidden();
  });

  test('IG-misc access request deny / approve (respond POST fulfilled)', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('ig-share-requests');
    await page.route(new RegExp(`/api/access/chart/${chart.id}/request-access$`), (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            json: [
              {
                id: ACCESS_REQUEST_ID,
                requester_id: 990400,
                requester_email: 'stub-requester@example.com',
                requested_level: 'edit',
                note: 'e2e stub',
                status: 'pending',
                created_at: '2026-01-01T00:00:00Z',
              },
            ],
          })
        : route.fallback()
    );
    const respondUrl = new RegExp(
      `/api/access/chart/${chart.id}/request-access/${ACCESS_REQUEST_ID}/respond$`
    );
    await page.route(respondUrl, (route) =>
      route.fulfill({ status: 200, json: { success: true } })
    );
    await openChartShare(page, chart.id);
    await expect(page.getByTestId(`access-request-row-${ACCESS_REQUEST_ID}`)).toContainText(
      'stub-requester@example.com wants to edit'
    );

    const deny = captureRequest(page, { method: 'POST', url: respondUrl });
    await page.getByTestId(`access-request-deny-${ACCESS_REQUEST_ID}`).click();
    const denyReq = await deny;
    expect(denyReq.body).toEqual({ decision: 'declined' });
    expectPayloadSnapshot(denyReq, 'ig-misc-access-request-deny');
    await expect(page.getByText('Request declined')).toBeVisible();

    const approve = captureRequest(page, { method: 'POST', url: respondUrl });
    await page.getByTestId(`access-request-approve-${ACCESS_REQUEST_ID}`).click();
    const approveReq = await approve;
    expect(approveReq.body).toEqual({ decision: 'approved', granted_level: 'edit' });
    expectPayloadSnapshot(approveReq, 'ig-misc-access-request-approve');
    await expect(page.getByText('Request approved')).toBeVisible();
  });

  test('IG-misc dashboard cascade dialog: cancel keeps level, continue sends PATCH (fulfilled)', async ({
    page,
    factory,
  }) => {
    const dash = await factory.dashboard('ig-share-cascade');
    await stubGrants(page, 'dashboard', dash.id, STUB_SHARES);
    await page.goto(`/dashboards/${dash.id}`);
    await page.getByTestId('dashboard-share-btn').click();
    await expect(page.getByTestId('general-access-select')).toBeVisible();
    const dialog = page.getByTestId('share-cascade-dialog');
    const level = page.getByTestId(`share-grant-level-${DIRECT_VIEW}`);

    let patched = false;
    page.on('request', (r) => {
      if (r.method() === 'PATCH' && grantsUrl('dashboard', dash.id).test(r.url())) patched = true;
    });
    await pickLevel(page, `share-grant-level-${DIRECT_VIEW}`, 'edit');
    await expect(dialog).toBeVisible();
    await page.getByTestId('share-cascade-cancel-btn').click();
    await expect(dialog).toBeHidden();
    await expect(level).toHaveText('View');
    expect(patched).toBe(false);

    await pickLevel(page, `share-grant-level-${DIRECT_VIEW}`, 'edit');
    const patch = captureRequest(page, { method: 'PATCH', url: grantsUrl('dashboard', dash.id) });
    await page.getByTestId('share-cascade-continue-btn').click();
    const req = await patch;
    expect(req.body).toEqual({ access_level: 'edit' });
    expectPayloadSnapshot(req, 'ig-misc-cascade-continue-level');
    await expect(dialog).toBeHidden();
  });

  test('IG-misc staged chip: level back to View, then remove (no request)', async ({
    page,
    factory,
  }) => {
    const chart = await factory.barChart('ig-share-chip');
    await openChartShare(page, chart.id);
    const email = 'ig-chip@example.com';
    const input = page.getByTestId('share-chip-input');
    await input.fill(email);
    await input.press('Enter');
    const key = `email:${email}`;
    const level = page.getByTestId(`share-chip-level-${key}`);
    await expect(level).toHaveText('View');

    await pickLevel(page, `share-chip-level-${key}`, 'edit');
    await expect(level).toHaveText('Edit');
    await pickLevel(page, `share-chip-level-${key}`, 'view');
    await expect(level).toHaveText('View');

    await page.getByTestId(`share-chip-remove-${key}`).click();
    await expect(level).toHaveCount(0);
    await expect(page.getByText(/isn't on Dalgo yet/)).toHaveCount(0);
    await expect(page.getByTestId('share-submit-btn')).toBeDisabled();
  });
});

test.describe('IG-misc request access dialog', () => {
  test.slow();

  test('IG-misc request access: pick level, cancel, then send Edit (POST fulfilled)', async ({
    factory,
    pageAs,
  }) => {
    const member = await pageAs('member');
    const dash = await factory.dashboard('ig-request-access');
    await setGeneralAccess(dash.id, 'private');
    const requestUrl = new RegExp(`/api/access/dashboard/${dash.id}/request-access$`);
    // A real request emails the owner → answer it here
    await member.route(requestUrl, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 200, json: { id: 1, requested_level: 'edit' } })
        : route.fallback()
    );

    await member.goto(`/dashboards/${dash.id}`);
    await expect(member.getByTestId('no-access')).toBeVisible({ timeout: 30_000 });
    const openDialog = async () => {
      await member.getByRole('button', { name: 'Request Access' }).click();
      await expect(member.getByTestId('request-access-dialog')).toBeVisible();
    };
    const level = member.getByTestId('request-access-level');

    await openDialog();
    await expect(level).toHaveText('View');
    await pickLevel(member, 'request-access-level', 'edit');
    await expect(level).toHaveText('Edit');
    await pickLevel(member, 'request-access-level', 'view');
    await expect(level).toHaveText('View');
    await member.getByTestId('request-access-cancel-btn').click();
    await expect(member.getByTestId('request-access-dialog')).toBeHidden();
    await expect(member.getByRole('button', { name: 'Request Access' })).toBeVisible();

    await openDialog();
    await pickLevel(member, 'request-access-level', 'edit');
    const post = captureRequest(member, { method: 'POST', url: requestUrl });
    await member.getByTestId('request-access-send-btn').click();
    const req = await post;
    expect(req.body).toEqual({ requested_level: 'edit' });
    expectPayloadSnapshot(req, 'ig-misc-request-access-edit');
    await expect(
      member.getByText('Your access request has been sent. The owner will review it.')
    ).toBeVisible();
  });
});

test.describe('IG-misc confirmation dialog (default testids)', () => {
  test('IG-misc confirmation dialog cancel sends nothing; confirm sends mark-all-read (fulfilled)', async ({
    page,
  }) => {
    // Only notifications' "Mark all as read" uses the default `confirmation-dialog` prefix among
    // pages reachable from the scanned areas; the button needs unread > 0 → stub the count
    await page.route(/\/api\/notifications\/unread_count$/, (route) =>
      route.fulfill({ status: 200, json: { res: 3 } })
    );
    const markAll = /\/api\/notifications\/mark_all_as_read$/;
    // The user's real notifications must not change → answer it here
    await page.route(markAll, (route) => route.fulfill({ status: 200, json: { success: true } }));
    let sent = 0;
    page.on('request', (r) => {
      if (markAll.test(r.url())) sent++;
    });

    await page.goto('/notifications');
    const dialog = page.getByTestId('confirmation-dialog');
    await page.getByTestId('mark-all-as-read-btn').click();
    await expect(dialog).toContainText('mark all 3 notifications as read');
    await page.getByTestId('confirmation-dialog-cancel-btn').click();
    await expect(dialog).toBeHidden();
    expect(sent).toBe(0);

    await page.getByTestId('mark-all-as-read-btn').click();
    const put = captureRequest(page, { method: 'PUT', url: markAll });
    await page.getByTestId('confirmation-dialog-confirm-btn').click();
    expectPayloadSnapshot(await put, 'ig-misc-confirmation-mark-all-read');
    await expect(dialog).toBeHidden();
    await expect(page.getByText('All notifications marked as read')).toBeVisible();
  });
});
