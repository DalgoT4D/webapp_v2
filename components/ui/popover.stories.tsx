import type { Meta, StoryObj } from '@storybook/nextjs';
import { Popover, PopoverTrigger, PopoverContent } from './popover';
import { Button } from './button';

const meta = {
  title: 'UI/Popover',
  component: Popover,
  tags: ['autodocs'],
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Renders open in the docs canvas so the content is visible. */
export const Open: Story = {
  render: () => (
    <Popover defaultOpen data-testid="popover-open">
      <PopoverTrigger asChild>
        <Button variant="outline" data-testid="popover-open-trigger">
          Open popover
        </Button>
      </PopoverTrigger>
      <PopoverContent data-testid="popover-open-content">
        <div className="space-y-2">
          <h4 className="font-medium leading-none">Dimensions</h4>
          <p className="text-muted-foreground text-sm">Set the dimensions for the layer.</p>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

/** Closed by default — click the trigger to open. */
export const Interactive: Story = {
  render: () => (
    <Popover data-testid="popover-interactive">
      <PopoverTrigger asChild>
        <Button variant="outline" data-testid="popover-interactive-trigger">
          Open popover
        </Button>
      </PopoverTrigger>
      <PopoverContent data-testid="popover-interactive-content">
        <div className="space-y-2">
          <h4 className="font-medium leading-none">Dimensions</h4>
          <p className="text-muted-foreground text-sm">Set the dimensions for the layer.</p>
        </div>
      </PopoverContent>
    </Popover>
  ),
};
