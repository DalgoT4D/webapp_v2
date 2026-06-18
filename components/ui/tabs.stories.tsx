import type { Meta, StoryObj } from '@storybook/nextjs';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';

const meta = {
  title: 'UI/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  argTypes: {
    defaultValue: { control: 'text' },
    orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A three-tab layout with an uncontrolled default selection. */
export const Default: Story = {
  args: { defaultValue: 'account' },
  render: (args) => (
    <Tabs {...args} className="w-[420px]" data-testid="tabs">
      <TabsList data-testid="tabs-list">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
        <TabsTrigger value="team">Team</TabsTrigger>
      </TabsList>
      <TabsContent value="account" className="pt-4 text-sm text-muted-foreground">
        Manage your account details and profile information here.
      </TabsContent>
      <TabsContent value="password" className="pt-4 text-sm text-muted-foreground">
        Change your password and security preferences.
      </TabsContent>
      <TabsContent value="team" className="pt-4 text-sm text-muted-foreground">
        Invite teammates and manage their roles.
      </TabsContent>
    </Tabs>
  ),
};

/** Two tabs is the minimal useful configuration. */
export const TwoTabs: Story = {
  args: { defaultValue: 'overview' },
  render: (args) => (
    <Tabs {...args} className="w-[360px]" data-testid="tabs-two">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="pt-4 text-sm text-muted-foreground">
        High-level summary of your workspace.
      </TabsContent>
      <TabsContent value="settings" className="pt-4 text-sm text-muted-foreground">
        Adjust workspace-level configuration.
      </TabsContent>
    </Tabs>
  ),
};

/** A disabled trigger cannot be activated. */
export const WithDisabledTab: Story = {
  args: { defaultValue: 'active' },
  render: (args) => (
    <Tabs {...args} className="w-[420px]" data-testid="tabs-disabled">
      <TabsList>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="archived" disabled>
          Archived
        </TabsTrigger>
        <TabsTrigger value="trash">Trash</TabsTrigger>
      </TabsList>
      <TabsContent value="active" className="pt-4 text-sm text-muted-foreground">
        Currently active items.
      </TabsContent>
      <TabsContent value="archived" className="pt-4 text-sm text-muted-foreground">
        Archived items.
      </TabsContent>
      <TabsContent value="trash" className="pt-4 text-sm text-muted-foreground">
        Items in the trash.
      </TabsContent>
    </Tabs>
  ),
};
