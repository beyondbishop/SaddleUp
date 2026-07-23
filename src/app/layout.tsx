import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: {
    default: 'SaddleUp | Buy & Sell Used English and Western Saddles',
    template: '%s | SaddleUp'
  },
  description:
    'SaddleUp is a marketplace for buying and selling used saddles, matched to your exact horse and rider measurements. Search by brand, tree width, seat size, and discipline.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4">{children}</main>
        <footer className="mt-16 border-t border-saddle-tan py-6 text-center text-sm text-gray-500">
          <div className="flex justify-center gap-4">
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <a href="/seller-agreement">Seller Agreement</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
