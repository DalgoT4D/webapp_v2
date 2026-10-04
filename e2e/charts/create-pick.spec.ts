import { test, expect } from '../support/fixtures';
import { SEED } from '../support/env';
import { ALL_CHART_TYPES } from './helpers-core';
import type { Page } from '@playwright/test';

/** MATRIX §1.2 — /charts/new: dataset + chart type picker. */

const DATASET_ID = 'chart-new-dataset-select';
const EDU = `${SEED.datasets.education.schema}.${SEED.datasets.education.table}`;

const TYPE_CARDS: Record<string, { name: string; description: string }> = {
  bar: { name: 'Bar Chart', description: 'Compare values across categories' },
  pie: { name: 'Pie Chart', description: 'Show proportions of a whole' },
  line: { name: 'Line Chart', description: 'Display trends over time' },
  number: { name: 'Number', description: 'Display key metrics and KPIs' },
  map: { name: 'Map', description: 'Visualize geographic data' },
  table: { name: 'Table', description: 'Display data in rows and columns' },
  pivot_table: { name: 'Pivot Table', description: 'Cross-tabulate data across two dimensions' },
};

/** Open the picker. The dataset list auto-opens (autoFocus) over the cards, so close it unless asked not to. */
async function gotoPick(page: Page, query = '', { keepListOpen = false } = {}) {
  const tables = page.waitForResponse((r) => r.url().includes('/api/warehouse/sync_tables'));
  await page.goto(`/charts/new${query}`);
  await tables;
  const input = page.getByTestId(`${DATASET_ID}-input`);
  await expect(input).toBeEnabled();
  await expect(page.getByTestId(`${DATASET_ID}-listbox`)).toBeVisible();
  if (!keepListOpen) {
    await input.press('Escape');
    await expect(page.getByTestId(`${DATASET_ID}-listbox`)).toBeHidden();
  }
}

async function pickDataset(page: Page, search: string, value: string) {
  const input = page.getByTestId(`${DATASET_ID}-input`);
  await input.click();
  await input.fill(search);
  await page.getByTestId(`${DATASET_ID}-item-${value}`).click();
  await expect(input).toHaveValue(value);
}

test.describe('charts create — step 1 (pick dataset + type)', () => {
  test('C-P1 page shows 7 type cards in order with descriptions, Continue disabled', async ({
    page,
  }) => {
    await gotoPick(page);
    await expect(page.getByRole('heading', { name: 'Create a new chart' })).toBeVisible();

    const cards = page.getByTestId('chart-type-grid').getByRole('radio');
    await expect(cards).toHaveCount(7);
    const ids = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(ids).toEqual(ALL_CHART_TYPES.map((t) => `chart-type-card-${t}`));

    for (const type of ALL_CHART_TYPES) {
      const card = page.getByTestId(`chart-type-card-${type}`);
      await expect(card).toHaveText(TYPE_CARDS[type].name);
      await expect(card).toHaveAttribute('aria-checked', 'false');
      await card.hover();
      // Radix renders the tooltip twice (visible bubble + a11y copy)
      await expect(
        page.getByRole('tooltip').filter({ hasText: TYPE_CARDS[type].description }).first()
      ).toBeAttached();
    }
    await expect(page.getByTestId('chart-type-continue-button')).toBeDisabled();
  });

  test('C-P1 dataset picker: autofocus opens list, search filters, no-match message, select', async ({
    page,
  }) => {
    await gotoPick(page, '', { keepListOpen: true });
    const input = page.getByTestId(`${DATASET_ID}-input`);
    // autoFocus → the list opens on load
    await expect(input).toBeFocused();
    await expect(page.getByTestId(`${DATASET_ID}-listbox`)).toBeVisible();

    await input.fill('zzz-no-such-dataset');
    await expect(page.getByTestId(`${DATASET_ID}-empty`)).toHaveText('No datasets found');

    await input.fill('mart_health_');
    const items = page.getByTestId(`${DATASET_ID}-listbox`).getByRole('option');
    await expect(items.first()).toBeVisible();
    const labels = await items.allInnerTexts();
    expect(labels.length).toBeGreaterThanOrEqual(5);
    for (const l of labels) expect(l).toContain('mart_health_');

    await expect(page.getByTestId(`${DATASET_ID}-item-${EDU}`)).toBeHidden();
    await input.fill('mart_education_program');
    await page.getByTestId(`${DATASET_ID}-item-${EDU}`).click();
    await expect(input).toHaveValue(EDU);
    await expect(page.getByTestId(`${DATASET_ID}-listbox`)).toBeHidden();
  });

  test('C-P1 Continue enabled only with dataset AND type; single selection among cards', async ({
    page,
  }) => {
    await gotoPick(page);
    const cont = page.getByTestId('chart-type-continue-button');

    // type only → still disabled
    await page.getByTestId('chart-type-card-pie').click();
    await expect(page.getByTestId('chart-type-card-pie')).toHaveAttribute('aria-checked', 'true');
    await expect(cont).toBeDisabled();

    // switching type keeps a single selection
    await page.getByTestId('chart-type-card-line').click();
    await expect(page.getByTestId('chart-type-card-line')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('chart-type-card-pie')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('chart-type-grid').locator('[aria-checked="true"]')).toHaveCount(
      1
    );
    await expect(cont).toBeDisabled();

    await pickDataset(page, 'mart_education', EDU);
    await expect(cont).toBeEnabled();
  });

  for (const type of ALL_CHART_TYPES) {
    test(`C-P1 Continue with ${type} → configure URL carries schema/table/type`, async ({
      page,
    }) => {
      await gotoPick(page);
      await pickDataset(page, 'mart_education', EDU);
      await page.getByTestId(`chart-type-card-${type}`).click();
      await page.getByTestId('chart-type-continue-button').click();
      await expect(page).toHaveURL(
        `/charts/new/configure?schema=production&table=mart_education_program&type=${type}`
      );
    });
  }

  test('C-P2 keyboard: Enter and Space select the focused card', async ({ page }) => {
    await gotoPick(page);
    const bar = page.getByTestId('chart-type-card-bar');
    const map = page.getByTestId('chart-type-card-map');

    await bar.focus();
    await page.keyboard.press('Enter');
    await expect(bar).toHaveAttribute('aria-checked', 'true');

    await map.focus();
    await page.keyboard.press('Space');
    await expect(map).toHaveAttribute('aria-checked', 'true');
    await expect(bar).toHaveAttribute('aria-checked', 'false');

    // any other key does nothing
    await page.getByTestId('chart-type-card-table').focus();
    await page.keyboard.press('a');
    await expect(page.getByTestId('chart-type-card-table')).toHaveAttribute(
      'aria-checked',
      'false'
    );
    await expect(map).toHaveAttribute('aria-checked', 'true');
  });

  test('C-P3 Back link and Cancel go to /charts', async ({ page }) => {
    await gotoPick(page);
    await page.getByTestId('chart-new-back-button').click();
    await expect(page).toHaveURL('/charts');

    await gotoPick(page);
    await page.getByTestId('chart-new-cancel-button').click();
    await expect(page).toHaveURL('/charts');
  });

  test('C-P3 from=dashboard: Back and Cancel go back in history', async ({ page }) => {
    await page.goto('/dashboards');
    await gotoPick(page, '?from=dashboard');
    await page.getByTestId('chart-new-back-button').click();
    await expect(page).toHaveURL('/dashboards');

    await gotoPick(page, '?from=dashboard');
    await page.getByTestId('chart-new-cancel-button').click();
    await expect(page).toHaveURL('/dashboards');
  });

  test('C-P3 from=dashboard: Continue replaces history and keeps from=dashboard', async ({
    page,
  }) => {
    await page.goto('/dashboards');
    await gotoPick(page, '?from=dashboard');
    await pickDataset(page, 'mart_education', EDU);
    await page.getByTestId('chart-type-card-bar').click();
    await page.getByTestId('chart-type-continue-button').click();
    await expect(page).toHaveURL(
      '/charts/new/configure?schema=production&table=mart_education_program&type=bar&from=dashboard'
    );
    // router.replace → the pick page is gone from history
    await page.goBack();
    await expect(page).toHaveURL('/dashboards');
  });

  test('C-P3 without from: Continue pushes, browser back returns to the picker', async ({
    page,
  }) => {
    await gotoPick(page);
    await pickDataset(page, 'mart_education', EDU);
    await page.getByTestId('chart-type-card-number').click();
    await page.getByTestId('chart-type-continue-button').click();
    await expect(page).toHaveURL(/\/charts\/new\/configure\?.*type=number/);
    await page.goBack();
    await expect(page).toHaveURL('/charts/new');
  });
});
