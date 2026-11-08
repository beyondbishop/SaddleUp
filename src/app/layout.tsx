import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Analytics } from '@vercel/analytics/next';
import { Suspense } from 'react';
import ScrollRestorer from '@/components/ScrollRestorer';
import ListPicker from '@/components/ListPicker';

export const metadata: Metadata = {
  metadataBase: new URL('https://saddleup.me'),
  title: {
    default: 'SaddleUp | Buy & Sell Used Close Contact Jumping Saddles',
    template: '%s | SaddleUp'
  },
  description:
    'SaddleUp is a marketplace for buying and selling used close contact jumping saddles, listed by seat size and tree width so you can match them to your horse and yourself.',
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
  openGraph: {
    type: 'website',
    url: 'https://saddleup.me',
    siteName: 'SaddleUp',
    title: 'SaddleUp — The fitted saddle marketplace',
    description:
      "Buy & sell used close contact jumping saddles by seat size and tree width, with insured shipping and a 5-day inspection window.",
    images: [{ url: '/preview.png', width: 1200, height: 630, alt: 'SaddleUp — the fitted saddle marketplace' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SaddleUp — The fitted saddle marketplace',
    description: 'Buy & sell used close contact jumping saddles by fit, with insured shipping and a 5-day inspection.',
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
          <ListPicker />
        </Suspense>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
