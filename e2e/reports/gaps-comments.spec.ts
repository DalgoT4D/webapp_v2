import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import type { ApiClient } from '../support/api-client';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { createReport, createReportDashboard, toast, withStableIds } from './helpers';
import {
  COMMENT_STATES_URL,
  COMMENTS_URL,
  failRoute,
  FORCED_FAILURE,
  grantReport,
  MARK_READ_URL,
  openReport,
  postComment,
  roleApi,
} from './helpers-gaps';

/**
 * Comment gaps. The second author is the e2e member (E2E_MEMBER_*), posting through its own API
 * session; the admin page is the one under test.
 *
 * Mentions: a real @mention of an org user emails them (triggers/mention.py), so posted mentions
 * only ever name non-org addresses (the backend drops those — no notification), and the
 * "mentioned" icon state is served from a mocked states response.
 */

// Non-org addresses: shown as mentions, never resolved to a user by the backend
const OUTSIDE_EMAIL = 'alice@example.com';
const MENTION_USERS = ['frank@example.com', 'grace@example.com'];

const INDICATORS = /^comment-(dot-unread|dot-outline|mention-badge)$/;

interface CommentListItem {
  id: number;
  is_deleted: boolean;
  content: string;
}

async function openCommentMenu(page: Page, commentId: number) {
  await page.getByTestId(`comment-${commentId}`).hover();
  await page.getByTestId(`comment-menu-${commentId}`).click();
}

async function deleteComment(page: Page, commentId: number) {
  await openCommentMenu(page, commentId);
  await page.getByTestId(`delete-btn-${commentId}`).click();
  await page.getByTestId(`confirm-delete-btn-${commentId}`).click();
}

async function commentStates(api: ApiClient, reportId: number) {
  const res = await api.get<{
    data: { states: Array<{ target_type: string; target_id: number | null; state: string }> };
  }>(`/api/reports/${reportId}/comments/states/`);
  return res.data.states;
}

test.describe('report comments — gaps (second author)', () => {
  // Shared staging backend under parallel load: these multi-request flows need the 3x budget
  test.slow();

  let member: ApiClient;

  test.beforeAll(async () => {
    member = await roleApi('member');
  });
  test.afterAll(async () => {
    await member.dispose();
  });

  test('GAP-R comment indicators: unread dot → opening marks read (outline); mentioned badge @sends-email', async ({
    page,
    pageAs,
    api,
    track,
    factory,
  }) => {
    await pageAs('member'); // skips when E2E_MEMBER_* is absent
    const dash = await createReportDashboard(api, factory, {
      name: 'gaps-cm-states',
      withKpi: true,
    });
    const report = await createReport(api, track, {
      name: 'gaps-cm-states-rep',
      dashboardId: dash.dashboardId,
    });
    const kpiId = dash.kpiId!;
    await grantReport(api, report.id, 'member', 'view');
    await postComment(member, report.id, {
      target_type: 'kpi',
      target_id: kpiId,
      content: 'Member question on the KPI',
    });

    await openReport(page, report.id);
    const trigger = page.getByTestId(`comment-trigger-kpi-${kpiId}`);
    // Unread: filled dot only
    await expect(trigger.getByTestId(INDICATORS)).toHaveCount(1);
    await expect(trigger.getByTestId('comment-dot-unread')).toBeVisible();

    // Opening the thread marks it read
    const markRead = captureRequest(page, { method: 'POST', url: MARK_READ_URL(report.id) });
    const statesRefetch = page.waitForResponse(
      (r) => r.request().method() === 'GET' && COMMENT_STATES_URL(report.id).test(r.url())
    );
    await trigger.click();
    expectPayloadSnapshot(
      withStableIds(await markRead, { [kpiId]: 'kpi' }),
      'gaps-comment-mark-read-kpi'
    );
    await statesRefetch;
    await page.keyboard.press('Escape');
    // Read: outline dot only
    await expect(trigger.getByTestId('comment-dot-outline')).toBeVisible();
    await expect(trigger.getByTestId(INDICATORS)).toHaveCount(1);
    // Persisted on the server
    await page.reload();
    await expect(
      page.getByTestId(`comment-trigger-kpi-${kpiId}`).getByTestId('comment-dot-outline')
    ).toBeVisible();

    // Mentioned (mocked states — see file header): "@" badge only
    await page.route(COMMENT_STATES_URL(report.id), (route) =>
      route.fulfill({
        status: 200,
        json: {
          success: true,
          data: { states: [{ target_type: 'kpi', target_id: kpiId, state: 'mentioned' }] },
        },
      })
    );
    await page.reload();
    const mentionedTrigger = page.getByTestId(`comment-trigger-kpi-${kpiId}`);
    await expect(mentionedTrigger.getByTestId('comment-mention-badge')).toHaveText('@');
    await expect(mentionedTrigger.getByTestId(INDICATORS)).toHaveCount(1);
  });

  test('[pinned] GAP-R new-comment dot on unseen comments; deep-link open does not mark read @sends-email', async ({
    page,
    pageAs,
    api,
    track,
    factory,
  }) => {
    await pageAs('member');
    const dash = await createReportDashboard(api, factory, { name: 'gaps-cm-newdot' });
    const report = await createReport(api, track, {
      name: 'gaps-cm-newdot-rep',
      dashboardId: dash.dashboardId,
    });
    await grantReport(api, report.id, 'member', 'view');
    const own = await postComment(api, report.id, {
      target_type: 'chart',
      target_id: dash.chartId,
      content: 'Admin note',
    });
    const unseen = await postComment(member, report.id, {
      target_type: 'chart',
      target_id: dash.chartId,
      content: 'Member reply',
    });

    const markReads: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && MARK_READ_URL(report.id).test(r.url())) markReads.push(r.url());
    });
    // Deep link auto-opens the thread without the open handler → comments fetched as unseen
    await openReport(page, report.id, `?commentTarget=chart&chartId=${dash.chartId}`);
    await expect(page.getByTestId(`comment-${unseen}`)).toContainText('Member reply');
    await expect(page.getByTestId(`comment-new-dot-${unseen}`)).toBeVisible();
    // Your own comment is never "new"
    await expect(page.getByTestId(`comment-new-dot-${own}`)).toHaveCount(0);
    // Pinned: autoOpen sets `open` directly, so no mark-read is sent and the thread stays unread
    expect(markReads).toHaveLength(0);
    expect(
      (await commentStates(api, report.id)).find((s) => s.target_id === dash.chartId)?.state
    ).toBe('unread');

    // Opening it by hand marks it read → the next open shows no dot
    await page.keyboard.press('Escape');
    const trigger = page.getByTestId(`comment-trigger-chart-${dash.chartId}`);
    const markedRead = page.waitForResponse(
      (r) => r.request().method() === 'POST' && MARK_READ_URL(report.id).test(r.url())
    );
    await trigger.click();
    await markedRead;
    // Fresh page: an immediate reopen can be served from SWR's deduped cache (still is_new)
    await openReport(page, report.id);
    await page.getByTestId(`comment-trigger-chart-${dash.chartId}`).click();
    await expect(page.getByTestId(`comment-${unseen}`)).toBeVisible();
    await expect(page.getByTestId(`comment-new-dot-${unseen}`)).toHaveCount(0);
  });

  test('GAP-R "deleted" placeholders disappear when every comment in a thread is deleted @sends-email', async ({
    page,
    pageAs,
    api,
    track,
    factory,
  }) => {
    await pageAs('member');
    const dash = await createReportDashboard(api, factory, { name: 'gaps-cm-alldel' });
    const report = await createReport(api, track, {
      name: 'gaps-cm-alldel-rep',
      dashboardId: dash.dashboardId,
    });
    await grantReport(api, report.id, 'member', 'view');
    const mine = await postComment(api, report.id, {
      target_type: 'chart',
      target_id: dash.chartId,
      content: 'Editor note',
    });
    const theirs = await postComment(member, report.id, {
      target_type: 'chart',
      target_id: dash.chartId,
      content: 'Viewer question',
    });

    await openReport(page, report.id);
    await page.getByTestId(`comment-trigger-chart-${dash.chartId}`).click();
    await expect(page.getByTestId(`comment-${theirs}`)).toBeVisible();

    // Moderator delete of the member's comment → placeholder (a live comment remains)
    await deleteComment(page, theirs);
    await expect(page.getByTestId(`comment-${theirs}-deleted-text`)).toHaveText(
      'This message was deleted'
    );
    await expect(page.getByTestId(`comment-${mine}`)).toBeVisible();

    // Delete the last live one → every placeholder is hidden, only the input is left
    await deleteComment(page, mine);
    await expect(page.getByTestId(`comment-${mine}`)).toHaveCount(0);
    await expect(page.getByTestId(`comment-${theirs}-deleted`)).toHaveCount(0);
    await expect(page.getByTestId(`comment-${mine}-deleted`)).toHaveCount(0);
    await expect(page.getByTestId('comment-input')).toBeVisible();

    // Both still exist server-side as soft-deleted rows — hiding them is the frontend's doing
    const listed = await api.get<{ data: CommentListItem[] }>(
      `/api/reports/${report.id}/comments/?target_type=chart&target_id=${dash.chartId}`
    );
    expect(listed.data.map((c) => [c.id, c.is_deleted])).toEqual([
      [mine, true],
      [theirs, true],
    ]);
  });
});

test.describe('report comments — gaps (single user)', () => {
  // Shared staging backend under parallel load: these multi-request flows need the 3x budget
  test.slow();

  test('GAP-R mentions show as highlighted emails in posted comments', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'gaps-cm-highlight' });
    const report = await createReport(api, track, {
      name: 'gaps-cm-highlight-rep',
      dashboardId: dash.dashboardId,
    });
    await openReport(page, report.id);
    await page.getByTestId('comment-trigger-summary').click();

    const post = captureRequest(page, { method: 'POST', url: COMMENTS_URL(report.id) });
    const created = page.waitForResponse(
      (r) => r.request().method() === 'POST' && COMMENTS_URL(report.id).test(r.url())
    );
    await page.getByTestId('comment-input').fill(`Ping @${OUTSIDE_EMAIL} please`);
    await page.getByTestId('comment-input').press('Enter');
    expectPayloadSnapshot(await post, 'gaps-comment-post-with-mention');
    const id = ((await (await created).json()) as { data: { id: number } }).data.id;

    const comment = page.getByTestId(`comment-${id}`);
    // The "@" is dropped and the address is rendered as its own emphasized span
    await expect(comment).toContainText(`Ping ${OUTSIDE_EMAIL} please`);
    // TODO testid: mention spans have no testid — matched by their exact text
    const mention = comment.getByText(OUTSIDE_EMAIL, { exact: true });
    await expect(mention).toHaveCSS('font-weight', '500');
    const plain = comment.getByText('Ping', { exact: true });
    await expect(plain).toHaveCSS('font-weight', '400');
    // Primary colour vs. the plain text's colour
    const [mentionColor, plainColor] = await Promise.all([
      mention.evaluate((el) => getComputedStyle(el).color),
      plain.evaluate((el) => getComputedStyle(el).color),
    ]);
    expect(mentionColor).not.toBe(plainColor);
  });

  test('GAP-R @mentions inside the comment edit box (PUT carries mentioned_emails)', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'gaps-cm-editmention' });
    const report = await createReport(api, track, {
      name: 'gaps-cm-editmention-rep',
      dashboardId: dash.dashboardId,
    });
    const seeded = await postComment(api, report.id, {
      target_type: 'summary',
      content: 'Draft note',
    });
    await page.route(/\/api\/reports\/mentionable-users\/$/, (route) =>
      route.fulfill({
        status: 200,
        json: { success: true, data: MENTION_USERS.map((email) => ({ email })) },
      })
    );
    await openReport(page, report.id);
    await page.getByTestId('comment-trigger-summary').click();
    await openCommentMenu(page, seeded);
    await page.getByTestId(`edit-btn-${seeded}`).click();

    const editBox = page.getByTestId(`comment-edit-textarea-${seeded}`);
    await expect(editBox).toBeFocused();
    await editBox.press('End');
    await editBox.pressSequentially(' cc @');
    const dropdown = page.getByTestId('mention-dropdown');
    await expect(dropdown.getByRole('option')).toHaveText([
      /frank@example\.com$/,
      /grace@example\.com$/,
    ]);
    await editBox.pressSequentially('gr');
    await expect(dropdown.getByRole('option')).toHaveText([/grace@example\.com$/]);
    await editBox.press('ArrowDown');
    await expect(page.getByTestId('mention-user-grace@example.com')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await editBox.press('Enter');
    await expect(dropdown).toBeHidden();
    await expect(editBox).toHaveValue('Draft note cc @grace@example.com ');

    // Mouse pick works in the edit box too
    await editBox.pressSequentially('and @fr');
    await page.getByTestId('mention-user-frank@example.com').click();
    await expect(editBox).toHaveValue('Draft note cc @grace@example.com and @frank@example.com ');

    const put = captureRequest(page, {
      method: 'PUT',
      url: new RegExp(`/api/reports/${report.id}/comments/${seeded}/$`),
    });
    await page.getByTestId(`save-edit-btn-${seeded}`).click();
    expectPayloadSnapshot(await put, 'gaps-comment-edit-with-mentions');
    const saved = page.getByTestId(`comment-${seeded}`);
    await expect(saved).toContainText('Draft note cc grace@example.com and frank@example.com');
    await expect(saved.getByText('grace@example.com', { exact: true })).toHaveCSS(
      'font-weight',
      '500'
    );
  });

  test('[pinned] GAP-R KPI deep link: ?commentTarget=kpi does not open; chart-style link does', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, {
      name: 'gaps-cm-kpilink',
      withKpi: true,
    });
    const report = await createReport(api, track, {
      name: 'gaps-cm-kpilink-rep',
      dashboardId: dash.dashboardId,
    });
    const kpiId = dash.kpiId!;
    const kpiComment = await postComment(api, report.id, {
      target_type: 'kpi',
      target_id: kpiId,
      content: 'KPI ping',
    });

    // Pinned: mention emails link KPI threads as ?commentTarget=kpi&chartId=<kpi>
    // (mention_service.py), but the viewer only auto-opens for commentTarget=chart
    await openReport(page, report.id, `?commentTarget=kpi&chartId=${kpiId}`);
    await expect(page.getByTestId(`comment-trigger-kpi-${kpiId}`)).toBeVisible();
    await expect(page.getByTestId(`comment-popover-kpi-${kpiId}`)).toHaveCount(0);

    // chartId is shared by charts and KPIs, so the chart form opens the KPI thread
    await openReport(page, report.id, `?commentTarget=chart&chartId=${kpiId}`);
    await expect(page.getByTestId(`comment-popover-kpi-${kpiId}`)).toBeVisible();
    await expect(page.getByTestId(`comment-${kpiComment}`)).toContainText('KPI ping');
    await expect(page.getByTestId('comment-popover-summary')).toHaveCount(0);
  });

  test('[pinned] GAP-R own KPI comment leaves the icon unread (post-submit mark-read sends chart_id)', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, {
      name: 'gaps-cm-ownkpi',
      withKpi: true,
    });
    const report = await createReport(api, track, {
      name: 'gaps-cm-ownkpi-rep',
      dashboardId: dash.dashboardId,
    });
    const kpiId = dash.kpiId!;
    await openReport(page, report.id);
    const trigger = page.getByTestId(`comment-trigger-kpi-${kpiId}`);
    const opened = page.waitForResponse(
      (r) => r.request().method() === 'POST' && MARK_READ_URL(report.id).test(r.url())
    );
    await trigger.click();
    await opened;

    const afterPost = captureRequest(page, { method: 'POST', url: MARK_READ_URL(report.id) });
    await page.getByTestId('comment-input').fill('My own KPI note');
    await page.getByTestId('comment-input').press('Enter');
    // Pinned: sends `chart_id` (not `target_id`) → the backend marks the target-less KPI row read
    expectPayloadSnapshot(
      withStableIds(await afterPost, { [kpiId]: 'kpi' }),
      'gaps-comment-mark-read-after-post'
    );
    await page.keyboard.press('Escape');
    await expect(trigger.getByTestId('comment-dot-unread')).toBeVisible();
    expect((await commentStates(api, report.id)).find((s) => s.target_id === kpiId)?.state).toBe(
      'unread'
    );
  });

  test('GAP-R comment post failure toast keeps the draft', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'gaps-cm-postfail' });
    const report = await createReport(api, track, {
      name: 'gaps-cm-postfail-rep',
      dashboardId: dash.dashboardId,
    });
    await page.route(COMMENTS_URL(report.id), (route) =>
      route.request().method() === 'POST' ? failRoute(route) : route.fallback()
    );
    await openReport(page, report.id);
    await page.getByTestId('comment-trigger-summary').click();

    const input = page.getByTestId('comment-input');
    await input.fill('Will not be stored');
    const post = captureRequest(page, { method: 'POST', url: COMMENTS_URL(report.id) });
    await input.press('Enter');
    expectPayloadSnapshot(await post, 'gaps-comment-post-failing');
    await expect(toast(page, FORCED_FAILURE)).toBeVisible();
    await expect(input).toHaveValue('Will not be stored');
    await expect(page.getByTestId('comment-submit-btn')).toBeEnabled();
    await expect(
      page.getByTestId('comment-popover-summary').getByText('Will not be stored')
    ).toHaveCount(0);
  });
});
