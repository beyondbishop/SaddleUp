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
        className="text-[13px] font-semibold text-saddle-brown border border-saddle-tan-line px-[18px] py-[9px] rounded-sm whitespace-nowrap transition-colors hover:bg-saddle-brown hover:text-saddle-cream hover:border-saddle-brown"
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
