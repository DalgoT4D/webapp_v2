import type { Meta, StoryObj } from '@storybook/nextjs';
import { Switch } from './switch';
import { Label } from './label';

const meta = {
  title: 'UI/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
  args: { disabled: false },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { 'data-testid': 'switch-default' } as Story['args'],
};

export const Checked: Story = {
  args: { checked: true, 'data-testid': 'switch-checked' } as Story['args'],
};

export const Unchecked: Story = {
  args: { checked: false, 'data-testid': 'switch-unchecked' } as Story['args'],
};

export const Disabled: Story = {
  args: { disabled: true, 'data-testid': 'switch-disabled' } as Story['args'],
};

export const DisabledChecked: Story = {
  args: {
    disabled: true,
    checked: true,
    'data-testid': 'switch-disabled-checked',
  } as Story['args'],
};

/** Switch paired with a Label via htmlFor/id. */
export const WithLabel: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Switch id="notifications" defaultChecked data-testid="switch-with-label" />
      <Label htmlFor="notifications">Enable notifications</Label>
    </div>
  ),
};

/** Checked, unchecked, and disabled states side by side. */
export const States: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch id="sw-unchecked" data-testid="switch-state-unchecked" />
        <Label htmlFor="sw-unchecked">Off</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch id="sw-checked" defaultChecked data-testid="switch-state-checked" />
        <Label htmlFor="sw-checked">On</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Switch id="sw-disabled" disabled data-testid="switch-state-disabled" />
        <Label htmlFor="sw-disabled">Disabled</Label>
      </div>
    </div>
  ),
};
