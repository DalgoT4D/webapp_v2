import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ScrollArea, ScrollBar } from './scroll-area';

const TAGS = Array.from({ length: 40 }, (_, i) => `Dataset v${i + 1}`);

const meta = {
  title: 'UI/ScrollArea',
  component: ScrollArea,
  tags: ['autodocs'],
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Vertical scrolling inside a fixed-height box. */
export const Vertical: Story = {
  render: () => (
    <ScrollArea className="h-72 w-64 rounded-md border" data-testid="scroll-area-vertical">
      <div className="p-4">
        <h4 className="mb-4 text-sm font-medium leading-none">Datasets</h4>
        {TAGS.map((tag) => (
          <div key={tag} className="border-b py-2 text-sm last:border-0">
            {tag}
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

/** Horizontal scrolling — wide content with an explicit horizontal ScrollBar. */
export const Horizontal: Story = {
  render: () => (
    <ScrollArea
      className="w-96 whitespace-nowrap rounded-md border"
      data-testid="scroll-area-horizontal"
    >
      <div className="flex w-max gap-4 p-4">
        {TAGS.map((tag) => (
          <div
            key={tag}
            className="flex h-24 w-32 shrink-0 items-center justify-center rounded-md border text-sm"
          >
            {tag}
          </div>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  ),
};
