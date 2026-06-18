import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from './sheet';
import { Button } from './button';

const meta = {
  title: 'UI/Sheet',
  component: Sheet,
  tags: ['autodocs'],
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

const SIDES = ['right', 'left', 'top', 'bottom'] as const;

/** Renders open in the docs canvas (default `right` side) so the content is visible. */
export const Open: Story = {
  render: () => (
    <Sheet defaultOpen data-testid="sheet-open">
      <SheetContent data-testid="sheet-open-content">
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>
            Make changes to your profile here. Click save when you&apos;re done.
          </SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="cancel" data-testid="sheet-open-cancel">
              Cancel
            </Button>
          </SheetClose>
          <Button variant="primary" data-testid="sheet-open-confirm">
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

/** Closed by default — click the trigger to slide the sheet in from the right. */
export const Interactive: Story = {
  render: () => (
    <Sheet data-testid="sheet-interactive">
      <SheetTrigger asChild>
        <Button data-testid="sheet-interactive-trigger">Open sheet</Button>
      </SheetTrigger>
      <SheetContent data-testid="sheet-interactive-content">
        <SheetHeader>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>
            Make changes to your profile here. Click save when you&apos;re done.
          </SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="cancel" data-testid="sheet-interactive-cancel">
              Cancel
            </Button>
          </SheetClose>
          <Button variant="primary" data-testid="sheet-interactive-confirm">
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

/** One trigger per `side` (left / right / top / bottom) to show the slide-in direction. */
export const Sides: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {SIDES.map((side) => (
        <Sheet key={side} data-testid={`sheet-${side}`}>
          <SheetTrigger asChild>
            <Button variant="outline" data-testid={`sheet-${side}-trigger`}>
              {side}
            </Button>
          </SheetTrigger>
          <SheetContent side={side} data-testid={`sheet-${side}-content`}>
            <SheetHeader>
              <SheetTitle>Side: {side}</SheetTitle>
              <SheetDescription>
                This sheet slides in from the <strong>{side}</strong> edge.
              </SheetDescription>
            </SheetHeader>
            <SheetFooter>
              <SheetClose asChild>
                <Button variant="cancel" data-testid={`sheet-${side}-close`}>
                  Close
                </Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  ),
};
