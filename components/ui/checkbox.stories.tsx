import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Checkbox } from './checkbox';
import { Label } from './label';

const meta = {
  title: 'UI/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: { disabled: false },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { 'data-testid': 'checkbox-default' } as Story['args'],
};

export const Checked: Story = {
  args: { checked: true, 'data-testid': 'checkbox-checked' } as Story['args'],
};

export const Unchecked: Story = {
  args: { checked: false, 'data-testid': 'checkbox-unchecked' } as Story['args'],
};

export const Indeterminate: Story = {
  args: { checked: 'indeterminate', 'data-testid': 'checkbox-indeterminate' } as Story['args'],
};

export const Disabled: Story = {
  args: { disabled: true, 'data-testid': 'checkbox-disabled' } as Story['args'],
};

export const DisabledChecked: Story = {
  args: {
    disabled: true,
    checked: true,
    'data-testid': 'checkbox-disabled-checked',
  } as Story['args'],
};

/** Checkbox paired with a Label via htmlFor/id. */
export const WithLabel: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Checkbox id="terms" defaultChecked data-testid="checkbox-with-label" />
      <Label htmlFor="terms">Accept terms and conditions</Label>
    </div>
  ),
};

/** Checked, unchecked, and disabled states side by side. */
export const States: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Checkbox id="state-unchecked" data-testid="checkbox-state-unchecked" />
        <Label htmlFor="state-unchecked">Unchecked</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Checkbox id="state-checked" defaultChecked data-testid="checkbox-state-checked" />
        <Label htmlFor="state-checked">Checked</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Checkbox id="state-disabled" disabled data-testid="checkbox-state-disabled" />
        <Label htmlFor="state-disabled">Disabled</Label>
      </div>
    </div>
  ),
};
