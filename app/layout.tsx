import type { Metadata } from 'next';
import './globals.css';
import { SWRProvider } from '@/lib/swr';
import { ClientLayout } from '@/components/client-layout';
import { PostHogProvider } from '@/app/posthog-provider';

export const metadata: Metadata = {
  description: 'Empowering organizations with intelligent data insights',
  icons: {
    icon: '/dalgo_favicon.svg?v=1',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans" suppressHydrationWarning={true}>
        <PostHogProvider>
          <SWRProvider>
            <ClientLayout>{children}</ClientLayout>
          </SWRProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
