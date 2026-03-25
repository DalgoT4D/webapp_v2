import type { Metadata } from 'next';
import {
  Anek_Latin,
  Farsan,
  Inter,
  PT_Serif,
  Merriweather,
  Playfair_Display,
} from 'next/font/google';
import './globals.css';
import { SWRProvider } from '@/lib/swr';
import { ClientLayout } from '@/components/client-layout';
import { PendoScript } from '@/components/pendo-script';

const anekLatin = Anek_Latin({
  variable: '--font-anek-latin',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const anekMono = Anek_Latin({
  variable: '--font-anek-mono',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

// Dashboard text box fonts
const farsan = Farsan({
  variable: '--font-farsan',
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const ptSerif = PT_Serif({
  variable: '--font-pt-serif',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

const merriweather = Merriweather({
  variable: '--font-merriweather',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

const playfairDisplay = Playfair_Display({
  variable: '--font-playfair-display',
  subsets: ['latin'],
  weight: ['400', '700'],
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
        className={`${anekLatin.variable} ${anekMono.variable} ${farsan.variable} ${inter.variable} ${ptSerif.variable} ${merriweather.variable} ${playfairDisplay.variable} antialiased font-sans`}
        suppressHydrationWarning={true}
      >
        <PendoScript />
        <SWRProvider>
          <ClientLayout>{children}</ClientLayout>
        </SWRProvider>
      </body>
    </html>
  );
}
