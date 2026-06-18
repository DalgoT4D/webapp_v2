import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './select';

const meta = {
  title: 'UI/Select',
  component: Select,
  tags: ['autodocs'],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const FRUITS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'orange', label: 'Orange' },
  { value: 'grape', label: 'Grape' },
] as const;

/** Renders open in the docs canvas so the option list is visible. */
export const Open: Story = {
  render: () => (
    <Select defaultOpen data-testid="select-open">
      <SelectTrigger className="w-[200px]" data-testid="select-open-trigger">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        {FRUITS.map((fruit) => (
          <SelectItem key={fruit.value} value={fruit.value}>
            {fruit.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
};

/** Closed by default — click the trigger to open. */
export const Interactive: Story = {
  render: () => (
    <Select data-testid="select-interactive">
      <SelectTrigger className="w-[200px]" data-testid="select-interactive-trigger">
        <SelectValue placeholder="Select a fruit" />
      </SelectTrigger>
      <SelectContent>
        {FRUITS.map((fruit) => (
          <SelectItem key={fruit.value} value={fruit.value}>
            {fruit.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
};
