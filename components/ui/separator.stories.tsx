import type { Meta, StoryObj } from '@storybook/nextjs';
import { Separator } from './separator';

const ORIENTATIONS = ['horizontal', 'vertical'] as const;

const meta = {
  title: 'UI/Separator',
  component: Separator,
  tags: ['autodocs'],
  argTypes: {
    orientation: { control: 'select', options: ORIENTATIONS },
  },
  args: { orientation: 'horizontal' },
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: (args) => (
    <div style={{ width: 240 }}>
      <p className="text-sm">Section one</p>
      <Separator {...args} className="my-4" data-testid="separator-horizontal" />
      <p className="text-sm">Section two</p>
    </div>
  ),
};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  render: (args) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 24 }}>
      <span className="text-sm">Charts</span>
      <Separator {...args} data-testid="separator-vertical" />
      <span className="text-sm">Dashboards</span>
      <Separator {...args} />
      <span className="text-sm">Reports</span>
    </div>
  ),
};

/** Both orientations side by side — the canonical reference grid. */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ width: 200 }}>
        <p className="text-sm">Above</p>
        <Separator orientation="horizontal" className="my-3" data-testid="separator-horizontal" />
        <p className="text-sm">Below</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 48 }}>
        <span className="text-sm">Left</span>
        <Separator orientation="vertical" data-testid="separator-vertical" />
        <span className="text-sm">Right</span>
      </div>
    </div>
  ),
};
