'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="border border-saddle-brown/40 px-4 py-1.5 rounded-md font-medium hover:bg-saddle-brown hover:text-saddle-cream transition-colors"
      >
        Account
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-saddle-tan rounded-lg shadow-lg py-2 z-50">
          <Link href="/favorites" className="block px-4 py-2 text-sm hover:bg-saddle-cream">Favorites</Link>
          <Link href="/watchlist" className="block px-4 py-2 text-sm hover:bg-saddle-cream">Watchlist</Link>
          <Link href="/messages" className="block px-4 py-2 text-sm hover:bg-saddle-cream">Messages</Link>
          <Link href="/orders" className="block px-4 py-2 text-sm hover:bg-saddle-cream">Orders</Link>
          <div className="border-t border-saddle-tan/50 my-1" />
          <Link href="/auth/login" className="block px-4 py-2 text-sm hover:bg-saddle-cream">Sign In</Link>
        </div>
      )}
    </div>
  );
}
