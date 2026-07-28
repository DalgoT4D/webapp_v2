import type { Meta, StoryObj } from '@storybook/nextjs';
import { Calculator, Calendar, CreditCard, Settings, Smile, User } from 'lucide-react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from './command';

const meta = {
  title: 'UI/Command',
  component: Command,
  tags: ['autodocs'],
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Inline command menu (cmdk) with two groups. It renders in place — no trigger needed.
 * Type in the input to filter; the empty group shows when nothing matches.
 */
export const Default: Story = {
  render: () => (
    <Command className="rounded-lg border shadow-md md:w-[450px]" data-testid="command-menu">
      <CommandInput placeholder="Type a command or search…" data-testid="command-input" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem data-testid="command-item-calendar">
            <Calendar />
            <span>Calendar</span>
          </CommandItem>
          <CommandItem data-testid="command-item-emoji">
            <Smile />
            <span>Search Emoji</span>
          </CommandItem>
          <CommandItem data-testid="command-item-calculator">
            <Calculator />
            <span>Calculator</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem data-testid="command-item-profile">
            <User />
            <span>Profile</span>
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem data-testid="command-item-billing">
            <CreditCard />
            <span>Billing</span>
            <CommandShortcut>⌘B</CommandShortcut>
          </CommandItem>
          <CommandItem data-testid="command-item-settings">
            <Settings />
            <span>Settings</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};
