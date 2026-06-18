import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Textarea } from './textarea';
import { Label } from './label';

const meta = {
  title: 'UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    rows: { control: 'number' },
    value: { control: 'text' },
  },
  args: { placeholder: 'Enter a longer message…', disabled: false },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { 'data-testid': 'textarea-default' } as Story['args'],
};

export const WithPlaceholder: Story = {
  args: {
    placeholder: 'Describe your dashboard…',
    'data-testid': 'textarea-placeholder',
  } as Story['args'],
};

export const WithValue: Story = {
  args: {
    defaultValue: 'This is some prefilled multi-line\ntextarea content.',
    'data-testid': 'textarea-value',
  } as Story['args'],
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: 'Disabled textarea',
    'data-testid': 'textarea-disabled',
  } as Story['args'],
};

/** Textarea paired with a Label via htmlFor/id. */
export const WithLabel: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
      <Label htmlFor="description-field">Description</Label>
      <Textarea
        id="description-field"
        placeholder="Add a description…"
        rows={4}
        data-testid="textarea-with-label"
      />
    </div>
  ),
};
