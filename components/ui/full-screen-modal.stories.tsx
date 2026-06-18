import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { FullScreenModal } from './full-screen-modal';
import { Button } from './button';

const meta = {
  title: 'UI/FullScreenModal',
  component: FullScreenModal,
  tags: ['autodocs'],
} satisfies Meta<typeof FullScreenModal>;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE_CONTENT = (
  <div className="p-7 space-y-3">
    <p className="text-sm text-gray-700">
      The modal fills the viewport with margins and scrolls its body. Drop any content here — logs,
      tables, forms — and it stays inside the scrollable area.
    </p>
    {Array.from({ length: 12 }).map((_, i) => (
      <p key={`row-${i}`} className="text-sm text-gray-500">
        Sample log line {i + 1} — lorem ipsum dolor sit amet, consectetur adipiscing elit.
      </p>
    ))}
  </div>
);

// Stateful wrapper — FullScreenModal is controlled (open + onOpenChange), so the
// story owns the open state and renders a trigger Button, exactly like the app.
function FullScreenModalDemo({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <Button data-testid="full-screen-modal-trigger" onClick={() => setOpen(true)}>
        Open full-screen modal
      </Button>
      <FullScreenModal
        open={open}
        onOpenChange={setOpen}
        title="Logs History"
        subtitle={<span>Daily Pipeline | Active</span>}
      >
        {SAMPLE_CONTENT}
      </FullScreenModal>
    </>
  );
}

/** Closed by default — click the trigger to open the full-screen modal. */
export const Interactive: Story = {
  render: () => <FullScreenModalDemo />,
};

/** Opens immediately in the docs canvas so the modal chrome and scroll area are visible. */
export const Open: Story = {
  render: () => <FullScreenModalDemo defaultOpen />,
};
