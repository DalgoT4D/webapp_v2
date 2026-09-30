import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import type { ApiClient } from '../support/api-client';
import { captureRequest, expectPayloadSnapshot } from '../support/payload';
import { SEED } from '../support/env';
import { createReport, createReportDashboard, openReport, withStableIds } from './helpers';

interface CommentRow {
  id: number;
}

const COMMENTS_URL = (reportId: number) => new RegExp(`/api/reports/${reportId}/comments/$`);

/** Seed a comment through the API (not the flow under test). */
async function addComment(
  api: ApiClient,
  reportId: number,
  body: { target_type: 'summary' | 'chart' | 'kpi'; target_id?: number; content: string }
): Promise<number> {
  const res = await api.post<{ data: CommentRow }>(`/api/reports/${reportId}/comments/`, {
    ...body,
    mentioned_emails: [],
  });
  return res.data.id;
}

/** Type a comment into an open popover and submit with Enter; returns the created comment id. */
async function submitComment(page: Page, reportId: number, text: string) {
  const created = page.waitForResponse(
    (r) => r.request().method() === 'POST' && COMMENTS_URL(reportId).test(r.url())
  );
  await page.getByTestId('comment-input').fill(text);
  await page.getByTestId('comment-input').press('Enter');
  const body = (await (await created).json()) as { data: CommentRow };
  return body.data.id;
}

/** Open a comment's hover-only "…" menu. */
async function openCommentMenu(page: Page, commentId: number) {
  await page.getByTestId(`comment-${commentId}`).hover();
  await page.getByTestId(`comment-menu-${commentId}`).click();
}

// Fake org users for the @mention dropdown — the staging org has a single user
const MENTION_USERS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'grace'].map(
  (n) => `${n}@example.com`
);
// Dropdown cap (comment-popover.tsx MENTION_DROPDOWN_LIMIT)
const MENTION_LIMIT = 5;

test.describe('report comments', () => {
  test('R-M1 summary thread: add (POST), edit (PUT) shows "edited", delete', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'comments-summary' });
    const report = await createReport(api, track, {
      name: 'comments-summary-rep',
      dashboardId: dash.dashboardId,
    });
    // Created before the page loads → its later edit is > 1s after creation (EDITED_THRESHOLD_MS)
    const seeded = await addComment(api, report.id, {
      target_type: 'summary',
      content: 'Seeded note',
    });
    await openReport(page, report.id);

    const trigger = page.getByTestId('comment-trigger-summary');
    await expect(trigger).toHaveAttribute('aria-label', 'Summary comments');
    await trigger.click();
    const popover = page.getByTestId('comment-popover-summary');
    await expect(popover).toBeVisible();
    await expect(page.getByTestId(`comment-${seeded}`)).toContainText('Seeded note');
    await expect(page.getByTestId(`comment-author-${seeded}`)).toHaveText(/\S+@\S+/);
    await expect(page.getByTestId(`comment-edited-${seeded}`)).toHaveCount(0);

    // Add
    await expect(page.getByTestId('comment-input')).toHaveAttribute(
      'placeholder',
      'Add a comment or @tag someone.'
    );
    await expect(page.getByTestId('comment-submit-btn')).toBeDisabled();
    const post = captureRequest(page, { method: 'POST', url: COMMENTS_URL(report.id) });
    const added = await submitComment(page, report.id, 'Looks good to me');
    expectPayloadSnapshot(await post, 'report-comment-summary-post');
    await expect(page.getByTestId(`comment-${added}`)).toContainText('Looks good to me');
    await expect(page.getByTestId('comment-input')).toHaveValue('');

    // Edit the seeded one (author = me)
    await openCommentMenu(page, seeded);
    await page.getByTestId(`edit-btn-${seeded}`).click();
    const editBox = page.getByTestId(`comment-edit-textarea-${seeded}`);
    await expect(editBox).toHaveValue('Seeded note');
    await editBox.fill('');
    await expect(page.getByTestId(`save-edit-btn-${seeded}`)).toBeDisabled();
    await editBox.fill('Seeded note (revised)');
    const put = captureRequest(page, {
      method: 'PUT',
      url: new RegExp(`/api/reports/${report.id}/comments/${seeded}/$`),
    });
    await page.getByTestId(`save-edit-btn-${seeded}`).click();
    expectPayloadSnapshot(await put, 'report-comment-put');
    await expect(page.getByTestId(`comment-${seeded}`)).toContainText('Seeded note (revised)');
    await expect(page.getByTestId(`comment-edited-${seeded}`)).toHaveText('· edited');

    // Cancel edit keeps the text
    await openCommentMenu(page, added);
    await page.getByTestId(`edit-btn-${added}`).click();
    await page.getByTestId(`comment-edit-textarea-${added}`).fill('never saved');
    await page.getByTestId(`cancel-edit-btn-${added}`).click();
    await expect(page.getByTestId(`comment-${added}`)).toContainText('Looks good to me');

    // Delete: cancel first, then confirm. Single-author thread → backend HARD-deletes, so the
    // comment just disappears (the "This message was deleted" placeholder needs a 2nd author —
    // covered in share.spec's moderation test)
    await openCommentMenu(page, added);
    await page.getByTestId(`delete-btn-${added}`).click();
    await expect(page.getByRole('alertdialog')).toContainText('Delete Comment');
    await page.getByTestId(`cancel-delete-btn-${added}`).click();
    await expect(page.getByTestId(`comment-${added}`)).toBeVisible();

    const del = captureRequest(page, {
      method: 'DELETE',
      url: new RegExp(`/api/reports/${report.id}/comments/${added}/$`),
    });
    await openCommentMenu(page, added);
    await page.getByTestId(`delete-btn-${added}`).click();
    await page.getByTestId(`confirm-delete-btn-${added}`).click();
    await del;
    await expect(page.getByTestId(`comment-${added}`)).toHaveCount(0);
    await expect(page.getByTestId(`comment-${added}-deleted`)).toHaveCount(0);
    await expect(page.getByTestId(`comment-${seeded}`)).toBeVisible();

    await openCommentMenu(page, seeded);
    await page.getByTestId(`delete-btn-${seeded}`).click();
    await page.getByTestId(`confirm-delete-btn-${seeded}`).click();
    await expect(page.getByTestId(`comment-${seeded}`)).toHaveCount(0);
    await expect(page.getByTestId('comment-input')).toBeVisible();
  });

  test('[pinned] R-M2 chart + KPI threads; chart icon never shows state (chart_id lookup bug)', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, {
      name: 'comments-widgets',
      withKpi: true,
    });
    const report = await createReport(api, track, {
      name: 'comments-widgets-rep',
      dashboardId: dash.dashboardId,
    });
    const kpiId = dash.kpiId!;
    const ids = { [dash.chartId]: 'chart', [kpiId]: 'kpi' };
    await openReport(page, report.id);

    const chartTrigger = page.getByTestId(`comment-trigger-chart-${dash.chartId}`);
    const kpiTrigger = page.getByTestId(`comment-trigger-kpi-${kpiId}`);
    await expect(chartTrigger).toHaveAttribute('aria-label', 'Chart comments');
    await expect(kpiTrigger).toHaveAttribute('aria-label', 'KPI comments');
    // No comments yet → no indicator on either
    await expect(chartTrigger.getByTestId(/^comment-(dot|mention)/)).toHaveCount(0);
    await expect(kpiTrigger.getByTestId(/^comment-(dot|mention)/)).toHaveCount(0);

    // Chart thread
    await chartTrigger.click();
    await expect(page.getByTestId(`comment-popover-chart-${dash.chartId}`)).toBeVisible();
    let post = captureRequest(page, { method: 'POST', url: COMMENTS_URL(report.id) });
    const chartComment = await submitComment(page, report.id, 'Chart looks off in Assam');
    expectPayloadSnapshot(withStableIds(await post, ids), 'report-comment-chart-post');
    await expect(page.getByTestId(`comment-${chartComment}`)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId(`comment-popover-chart-${dash.chartId}`)).toBeHidden();

    // KPI thread
    await kpiTrigger.click();
    await expect(page.getByTestId(`comment-popover-kpi-${kpiId}`)).toBeVisible();
    post = captureRequest(page, { method: 'POST', url: COMMENTS_URL(report.id) });
    const kpiComment = await submitComment(page, report.id, 'KPI target needs review');
    expectPayloadSnapshot(withStableIds(await post, ids), 'report-comment-kpi-post');
    await expect(page.getByTestId(`comment-${kpiComment}`)).toBeVisible();
    // Threads are separate per target
    await expect(page.getByTestId(`comment-${chartComment}`)).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Backend reports a state for BOTH targets …
    const states = await api.get<{
      data: { states: Array<{ target_type: string; target_id: number }> };
    }>(`/api/reports/${report.id}/comments/states/`);
    expect(states.data.states.map((s) => `${s.target_type}:${s.target_id}`).sort()).toEqual(
      [`chart:${dash.chartId}`, `kpi:${kpiId}`].sort()
    );
    // … the KPI icon (looks up target_id) shows it, the chart icon (looks up chart_id) never does
    await expect(kpiTrigger.getByTestId(/^comment-(dot|mention)/)).toHaveCount(1);
    await expect(chartTrigger.getByTestId(/^comment-(dot|mention)/)).toHaveCount(0);
  });

  test('[pinned] R-M3 @mention dropdown: max 5, filter, arrows wrap, Enter/click insert, Esc closes', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'comments-mention' });
    const report = await createReport(api, track, {
      name: 'comments-mention-rep',
      dashboardId: dash.dashboardId,
    });
    await page.route(/\/api\/reports\/mentionable-users\/$/, (route) =>
      route.fulfill({
        status: 200,
        json: { success: true, data: MENTION_USERS.map((email) => ({ email })) },
      })
    );
    // Mentions trigger notifications → never let this comment reach the backend
    await page.route(COMMENTS_URL(report.id), (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 200, json: { success: true, data: { id: 0 } } })
        : route.continue()
    );
    await openReport(page, report.id);
    await page.getByTestId('comment-trigger-summary').click();

    const input = page.getByTestId('comment-input');
    const dropdown = page.getByTestId('mention-dropdown');
    const options = dropdown.getByRole('option');

    // Bare "@" → first 5 users
    await input.pressSequentially('Ping @');
    await expect(dropdown).toBeVisible();
    await expect(options).toHaveCount(MENTION_LIMIT);
    await expect(options.first()).toHaveAttribute('data-testid', 'mention-user-alice@example.com');
    await expect(page.getByTestId('mention-user-frank@example.com')).toHaveCount(0);

    // Case-insensitive substring filter
    await input.pressSequentially('RA');
    // Option text = avatar initial + email
    await expect(options).toHaveText([/frank@example\.com$/, /grace@example\.com$/]);

    // Arrows wrap; Enter inserts the highlighted user
    await input.press('ArrowDown');
    await expect(page.getByTestId('mention-user-frank@example.com')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await input.press('ArrowDown');
    await input.press('ArrowDown');
    await expect(page.getByTestId('mention-user-frank@example.com')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await input.press('ArrowUp');
    await expect(page.getByTestId('mention-user-grace@example.com')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await input.press('Enter');
    await expect(dropdown).toBeHidden();
    await expect(input).toHaveValue('Ping @grace@example.com ');

    // Mouse selection
    await input.pressSequentially('and @bo');
    await expect(options).toHaveText([/bob@example\.com$/]);
    await page.getByTestId('mention-user-bob@example.com').click();
    await expect(input).toHaveValue('Ping @grace@example.com and @bob@example.com ');
    // Clicking inside the dropdown did not close the popover
    await expect(page.getByTestId('comment-popover-summary')).toBeVisible();

    // No match → no dropdown; deleting back to a match reopens it
    await input.pressSequentially('@zzz');
    await expect(dropdown).toBeHidden();
    await input.press('Backspace');
    await input.press('Backspace');
    await input.press('Backspace');
    await expect(dropdown).toBeVisible();
    await input.press('Backspace');
    await expect(dropdown).toBeHidden();

    // Submit → mentioned_emails extracted from the text (intercepted, never stored)
    const post = captureRequest(page, { method: 'POST', url: COMMENTS_URL(report.id) });
    await input.press('Enter');
    expectPayloadSnapshot(await post, 'report-comment-mention-post');
    await expect(input).toHaveValue('');

    // Pinned: Escape with the dropdown open closes the dropdown AND the whole popover
    // (Radix's document-level Escape handler runs before the input's preventDefault)
    await input.pressSequentially('@');
    await expect(dropdown).toBeVisible();
    await input.press('Escape');
    await expect(page.getByTestId('comment-popover-summary')).toBeHidden();
    await expect(dropdown).toBeHidden();
  });

  test('R-M4 deep links ?commentTarget=summary and =chart&chartId= auto-open the thread', async ({
    page,
    api,
    track,
    factory,
  }) => {
    const dash = await createReportDashboard(api, factory, { name: 'comments-deeplink' });
    const report = await createReport(api, track, {
      name: 'comments-deeplink-rep',
      dashboardId: dash.dashboardId,
    });
    const summaryComment = await addComment(api, report.id, {
      target_type: 'summary',
      content: 'Summary ping',
    });
    const chartComment = await addComment(api, report.id, {
      target_type: 'chart',
      target_id: dash.chartId,
      content: 'Chart ping',
    });

    await openReport(page, report.id, '?commentTarget=summary');
    await expect(page.getByTestId('comment-popover-summary')).toBeVisible();
    await expect(page.getByTestId(`comment-${summaryComment}`)).toContainText('Summary ping');
    await expect(page.getByTestId(`comment-popover-chart-${dash.chartId}`)).toHaveCount(0);

    await openReport(page, report.id, `?commentTarget=chart&chartId=${dash.chartId}`);
    await expect(page.getByTestId(`comment-popover-chart-${dash.chartId}`)).toBeVisible();
    await expect(page.getByTestId(`comment-${chartComment}`)).toContainText('Chart ping');
    await expect(page.getByTestId('comment-popover-summary')).toHaveCount(0);
  });

  test('R-M1 seed report 150: summary thread opens read-only-safe (no posting)', async ({
    page,
  }) => {
    await openReport(page, SEED.reports.education);
    await page.getByTestId('comment-trigger-summary').click();
    await expect(page.getByTestId('comment-popover-summary')).toBeVisible();
    await expect(page.getByTestId('comment-input')).toBeVisible();
    await expect(page.getByTestId('comment-submit-btn')).toBeDisabled();
  });
});
