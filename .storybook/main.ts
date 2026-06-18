import type { StorybookConfig } from '@storybook/nextjs-vite';
import path from 'path';
import { fileURLToPath } from 'url';

// main.ts is loaded as ESM, so __dirname is undefined — derive it.
const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ['../stories/**/*.mdx', '../components/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
  staticDirs: ['../public'],
  // The app's next.config.ts adds a single webpack alias ('@' -> repo root).
  // nextjs-vite ignores next webpack config, so re-add it for Vite here.
  viteFinal: async (viteConfig) => {
    viteConfig.resolve = viteConfig.resolve ?? {};
    viteConfig.resolve.alias = {
      ...(viteConfig.resolve.alias ?? {}),
      '@': path.resolve(dirname, '..'),
    };
    return viteConfig;
  },
};

export default config;
