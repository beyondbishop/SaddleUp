import Link from 'next/link';
import AccountMenu from './AccountMenu';

export default function Navbar() {
  return (
    <header className="bg-saddle-cream border-b border-saddle-tan/40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif italic text-2xl text-saddle-brown">
          SaddleUp
        </Link>
        <nav className="flex gap-6 text-sm items-center text-saddle-brown">
          <Link href="/saddles">Browse Saddles</Link>
          <Link href="/match">Find My Fit</Link>
          <Link href="/dashboard">Sell a Saddle</Link>
          <AccountMenu />
        </nav>
      </div>
    </header>
  );
}
