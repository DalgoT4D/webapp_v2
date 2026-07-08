import type { Meta, StoryObj } from '@storybook/nextjs';
import { Badge } from './badge';

const VARIANTS = ['default', 'secondary', 'destructive', 'outline'] as const;

const meta = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
  },
  args: { children: 'Badge', variant: 'default' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Destructive: Story = { args: { variant: 'destructive' } };
export const Outline: Story = { args: { variant: 'outline' } };

/** Every variant rendered together — the canonical reference grid. */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {VARIANTS.map((variant) => (
        <Badge key={variant} variant={variant} data-testid={`badge-${variant}`}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};
