import type { Meta, StoryObj } from '@storybook/nextjs';
import { Button } from './button';

const VARIANTS = [
  'default',
  'primary',
  'destructive',
  'outline',
  'cancel',
  'secondary',
  'ghost',
  'link',
] as const;

const SIZES = ['default', 'sm', 'lg', 'icon'] as const;

const meta = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    size: { control: 'select', options: SIZES },
    disabled: { control: 'boolean' },
  },
  args: { children: 'Button', variant: 'default', size: 'default' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Primary: Story = { args: { variant: 'primary' } };
export const Destructive: Story = { args: { variant: 'destructive' } };
export const Outline: Story = { args: { variant: 'outline' } };
export const Cancel: Story = { args: { variant: 'cancel', children: 'Cancel' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Link: Story = { args: { variant: 'link', children: 'Link button' } };
export const Disabled: Story = { args: { disabled: true } };

/** Every variant rendered together — the canonical reference grid. */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {VARIANTS.map((variant) => (
        <Button key={variant} variant={variant} data-testid={`button-${variant}`}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};

/** All sizes (icon shows a glyph instead of a label). */
export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      {SIZES.map((size) => (
        <Button key={size} size={size} data-testid={`button-size-${size}`}>
          {size === 'icon' ? '★' : size}
        </Button>
      ))}
    </div>
  ),
};
