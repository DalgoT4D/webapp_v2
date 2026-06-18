import type { Meta, StoryObj } from '@storybook/nextjs';
import { OverflowTooltip } from './overflow-tooltip';

const LONG_TEXT =
  'Monthly beneficiary outcomes across all programs and regions for fiscal year 2026';
const SHORT_TEXT = 'Revenue';

const meta = {
  title: 'UI/OverflowTooltip',
  component: OverflowTooltip,
  tags: ['autodocs'],
  argTypes: {
    text: { control: 'text' },
    tooltipSide: { control: 'select', options: ['top', 'bottom', 'left', 'right'] },
    tooltipAlign: { control: 'select', options: ['start', 'center', 'end'] },
  },
} satisfies Meta<typeof OverflowTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Narrow container forces truncation — hover the text to see the tooltip. */
export const Truncated: Story = {
  args: { text: LONG_TEXT },
  render: (args) => (
    <div className="w-40 rounded-md border p-2" data-testid="overflow-tooltip-truncated">
      <OverflowTooltip {...args} />
    </div>
  ),
};

/** Text fits, so no tooltip appears on hover. */
export const NotTruncated: Story = {
  args: { text: SHORT_TEXT },
  render: (args) => (
    <div className="w-40 rounded-md border p-2" data-testid="overflow-tooltip-not-truncated">
      <OverflowTooltip {...args} />
    </div>
  ),
};
