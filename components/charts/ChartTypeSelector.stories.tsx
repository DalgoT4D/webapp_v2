import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { ChartTypeSelector } from './ChartTypeSelector';

// Stateful wrapper — ChartTypeSelector is controlled (value + onChange), so the
// story holds the selection so the cards highlight on click, exactly like the app.
function ChartTypeSelectorDemo({ disabled }: { disabled?: boolean }) {
  const [value, setValue] = useState('bar');
  return (
    <div style={{ width: 760 }}>
      <ChartTypeSelector value={value} onChange={setValue} disabled={disabled} />
    </div>
  );
}

const meta = {
  title: 'Charts/ChartTypeSelector',
  component: ChartTypeSelector,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ChartTypeSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The real "Choose chart type" cards. Icon + selected-card colors come from
 * `getChartTypeColor` → `CHART_TYPE_COLORS` (constants/chart-types.ts) — the same
 * palette shown in Foundations/Colors. Click a card to see its selected color.
 *
 * Note: the unselected icon hardcodes `#6B7280` (ChartTypeSelector.tsx:89) and the
 * heading uses `text-gray-900` instead of `text-foreground` — see Foundations/Drift.
 */
export const Default: Story = {
  render: () => <ChartTypeSelectorDemo />,
};

export const Disabled: Story = {
  render: () => <ChartTypeSelectorDemo disabled />,
};
