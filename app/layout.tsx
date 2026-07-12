import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { SWRProvider } from '@/lib/swr';
import { ClientLayout } from '@/components/client-layout';
import { PostHogProvider } from '@/app/posthog-provider';

const anekLatin = localFont({
  src: '../public/fonts/AnekLatin.woff2',
  variable: '--font-anek-latin',
  weight: '400 700',
  display: 'swap',
});

const anekMono = localFont({
  src: '../public/fonts/AnekLatin.woff2',
  variable: '--font-anek-mono',
  weight: '400 700',
  display: 'swap',
});

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
      <body
        className={`${anekLatin.variable} ${anekMono.variable} antialiased font-sans`}
        suppressHydrationWarning={true}
      >
        <PostHogProvider>
          <SWRProvider>
            <ClientLayout>{children}</ClientLayout>
          </SWRProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
