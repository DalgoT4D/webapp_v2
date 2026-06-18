import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './dropdown-menu';
import { Button } from './button';

const meta = {
  title: 'UI/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Renders open in the docs canvas so the menu is visible. */
export const Open: Story = {
  render: () => (
    <DropdownMenu defaultOpen data-testid="dropdown-menu-open">
      <DropdownMenuTrigger asChild>
        <Button variant="outline" data-testid="dropdown-menu-open-trigger">
          Open menu
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent data-testid="dropdown-menu-open-content">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="dropdown-menu-open-profile">Profile</DropdownMenuItem>
        <DropdownMenuItem data-testid="dropdown-menu-open-settings">Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" data-testid="dropdown-menu-open-logout">
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

/** Closed by default — click the trigger to open. */
export const Interactive: Story = {
  render: () => (
    <DropdownMenu data-testid="dropdown-menu-interactive">
      <DropdownMenuTrigger asChild>
        <Button variant="outline" data-testid="dropdown-menu-interactive-trigger">
          Open menu
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent data-testid="dropdown-menu-interactive-content">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="dropdown-menu-interactive-profile">Profile</DropdownMenuItem>
        <DropdownMenuItem data-testid="dropdown-menu-interactive-settings">
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" data-testid="dropdown-menu-interactive-logout">
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
