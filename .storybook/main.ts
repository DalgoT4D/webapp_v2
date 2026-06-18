import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../stories/**/*.mdx', '../components/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: ['../public'],
  // @storybook/nextjs loads next.config.ts automatically, so the app's webpack
  // alias ('@' -> repo root) is applied for free — no manual alias config needed.
};

export default config;
