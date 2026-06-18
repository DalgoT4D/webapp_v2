import type { Meta, StoryObj } from '@storybook/nextjs';
import { Label } from './label';
import { Input } from './input';

const meta = {
  title: 'UI/Label',
  component: Label,
  tags: ['autodocs'],
  argTypes: {
    children: { control: 'text' },
    htmlFor: { control: 'text' },
  },
  args: { children: 'Label text' },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { 'data-testid': 'label-default' } as Story['args'],
};

/** Label associated with an Input via htmlFor/id. */
export const WithInput: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 8, maxWidth: 280 }}>
      <Label htmlFor="name-field" data-testid="label-with-input">
        Full name
      </Label>
      <Input id="name-field" placeholder="Jane Doe" data-testid="label-input" />
    </div>
  ),
};

/** A disabled peer input dims the associated label (peer-disabled styling). */
export const DisabledPeer: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 8, maxWidth: 280 }}>
      <Input id="disabled-field" className="peer" disabled placeholder="Disabled" />
      <Label htmlFor="disabled-field" data-testid="label-disabled-peer">
        Disabled field label
      </Label>
    </div>
  ),
};
