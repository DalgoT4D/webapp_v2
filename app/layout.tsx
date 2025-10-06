import type { Metadata } from 'next';
import { Anek_Latin } from 'next/font/google';
import './globals.css';
import { SWRProvider } from '@/lib/swr';
import { ClientLayout } from '@/components/client-layout';

const anekLatin = Anek_Latin({
  variable: '--font-anek-latin',
  subsets: ['latin'],
  display: 'swap',
});

const anekMono = Anek_Latin({
  variable: '--font-anek-mono',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  description: 'Empowering organizations with intelligent data insights',
  icons: {
    icon: '/dalgo_favicon.svg?v=1',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${anekLatin.variable} ${anekMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        <SWRProvider>
          <ClientLayout>{children}</ClientLayout>
        </SWRProvider>
      </body>
    </html>
  );
}
