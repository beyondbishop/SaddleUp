import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Analytics } from '@vercel/analytics/next';
import { Suspense } from 'react';
import ScrollRestorer from '@/components/ScrollRestorer';

export const metadata: Metadata = {
  metadataBase: new URL('https://saddleup.me'),
  title: {
    default: 'SaddleUp | Buy & Sell Used English and Western Saddles',
    template: '%s | SaddleUp'
  },
  description:
    'SaddleUp is a marketplace for buying and selling used saddles, matched to your exact horse and rider measurements. Search by brand, tree width, seat size, and discipline.',
  icons: { icon: '/favicon.png' },
  openGraph: {
    type: 'website',
    url: 'https://saddleup.me',
    siteName: 'SaddleUp',
    title: 'SaddleUp — The fitted saddle marketplace',
    description:
      "Buy & sell used saddles matched to your horse's back and your seat size. Insured, with a 5-day inspection window.",
    images: [{ url: '/preview.png', width: 1200, height: 630, alt: 'SaddleUp — the fitted saddle marketplace' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SaddleUp — The fitted saddle marketplace',
    description: 'Buy & sell used saddles matched to your horse and rider. Insured, with a 5-day inspection.',
    images: ['/preview.png']
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4">{children}</main>
        <Suspense fallback={null}>
          <ScrollRestorer />
        </Suspense>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
