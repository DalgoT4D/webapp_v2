import type { Preview, Decorator } from '@storybook/nextjs';
import { Anek_Latin } from 'next/font/google';
import { Toaster } from 'sonner';
import React from 'react';
import '../app/globals.css';

// Mirror the fonts the real app loads in app/layout.tsx so components render
// with Dalgo's actual typeface, not a system fallback.
const anekLatin = Anek_Latin({
  variable: '--font-anek-latin',
  subsets: ['latin'],
  display: 'swap',
});
const anekMono = Anek_Latin({
  variable: '--font-anek-mono',
  subsets: ['latin'],
  display: 'swap',
});

// Dark mode in globals.css keys off an ancestor `.dark` class
// (@custom-variant dark (&:is(.dark *))). Toggling the class on the wrapper
// flips every token, exactly like the running app.
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? 'light';
  return (
    <div
      className={`${anekLatin.variable} ${anekMono.variable} font-sans antialiased ${theme === 'dark' ? 'dark' : ''}`}
      style={{
        background: 'var(--background)',
        color: 'var(--foreground)',
        padding: '2rem',
        minHeight: '100vh',
      }}
    >
      <Story />
      {/* Mirror the app's notification host so Toast stories render. */}
      <Toaster richColors position="top-center" />
    </div>
  );
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    layout: 'centered',
    a11y: { test: 'todo' },
    options: {
      storySort: {
        order: [
          'Foundations',
          [
            'Introduction',
            'Colors',
            'Typography',
            'Spacing',
            'Elevation',
            'Iconography',
            'Motion',
            'Radius',
            'Drift',
          ],
          'UI',
          'Charts',
        ],
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Dalgo light / dark theme',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withTheme],
};

export default preview;
