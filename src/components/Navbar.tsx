import Link from 'next/link';

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
          <Link href="/favorites">Favorites</Link>
          <Link href="/watchlist">Watchlist</Link>
          <Link href="/messages">Messages</Link>
          <Link href="/orders">Orders</Link>
          <Link href="/dashboard">Sell a Saddle</Link>
          <Link
            href="/auth/login"
            className="border border-saddle-brown/40 px-4 py-1.5 rounded-md font-medium hover:bg-saddle-brown hover:text-saddle-cream transition-colors"
          >
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  );
}
