import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Tooltip, TooltipTrigger, TooltipContent } from './tooltip';
import { Button } from './button';

// Tooltip wraps its own TooltipProvider internally, so no extra provider is needed here.
const meta = {
  title: 'UI/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  argTypes: {
    defaultOpen: { control: 'boolean' },
    delayDuration: { control: 'number' },
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Hover (or focus) the button to reveal the tooltip. */
export const Default: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <TooltipTrigger asChild>
        <Button variant="outline" data-testid="tooltip-trigger">
          Hover me
        </Button>
      </TooltipTrigger>
      <TooltipContent data-testid="tooltip-content">Add to library</TooltipContent>
    </Tooltip>
  ),
};

/** Open by default so the content is visible without interaction. */
export const OpenByDefault: Story = {
  args: { defaultOpen: true },
  render: (args) => (
    <div style={{ padding: 48 }}>
      <Tooltip {...args}>
        <TooltipTrigger asChild>
          <Button variant="outline" data-testid="tooltip-trigger-open">
            Always shown
          </Button>
        </TooltipTrigger>
        <TooltipContent data-testid="tooltip-content-open">This tooltip starts open</TooltipContent>
      </Tooltip>
    </div>
  ),
};

/**
 * ⚠️ DRIFT — the canonical tooltip is teal (`bg-primary`), but several screens
 * override it to black with `className="bg-gray-900 text-white border-gray-700"`.
 * Sites found: `app/charts/new/page.tsx:231`, `app/charts/page.tsx:851`,
 * `app/notifications/page.tsx:176`, `components/dashboard/dashboard-list-v2.tsx:1076,1385`.
 * This story renders the canonical default next to the override so the
 * inconsistency is visible. Decide ONE canonical style and drop the overrides
 * (or add a real `variant="dark"` to the component).
 */
export const DriftDefaultVsOverride: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 80, padding: 64 }}>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant="outline" data-testid="tooltip-canonical">
            Canonical (teal)
          </Button>
        </TooltipTrigger>
        <TooltipContent data-testid="tooltip-canonical-content">
          bg-primary — the shared default
        </TooltipContent>
      </Tooltip>

      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant="outline" data-testid="tooltip-override">
            Override (charts/new)
          </Button>
        </TooltipTrigger>
        <TooltipContent
          className="bg-gray-900 text-white border-gray-700"
          data-testid="tooltip-override-content"
        >
          bg-gray-900 — local override (drift)
        </TooltipContent>
      </Tooltip>
    </div>
  ),
};

/** Tooltip placed on each side of the trigger. */
export const Sides: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 32, padding: 64 }}>
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <Tooltip key={side}>
          <TooltipTrigger asChild>
            <Button variant="outline" data-testid={`tooltip-trigger-${side}`}>
              {side}
            </Button>
          </TooltipTrigger>
          <TooltipContent side={side} data-testid={`tooltip-content-${side}`}>
            Tooltip on {side}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  ),
};
