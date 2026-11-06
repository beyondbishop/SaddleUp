'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

const item = 'block px-4 py-2 text-sm hover:bg-saddle-cream';
const heading = 'px-4 pt-2 pb-1 font-mono text-[10px] tracking-[0.16em] uppercase text-saddle-gold';

export default function AccountMenu({ isAdmin, isImporter = false, pendingCount = 0 }: { isAdmin: boolean; isImporter?: boolean; pendingCount?: number }) {
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
        aria-expanded={open}
        className="relative text-[13px] font-semibold text-saddle-brown border border-saddle-tan-line px-[18px] py-[9px] rounded-sm whitespace-nowrap transition-colors hover:bg-saddle-brown hover:text-saddle-cream hover:border-saddle-brown"
      >
        Account
        {isAdmin && pendingCount > 0 && (
          <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-saddle-green text-saddle-cream text-[11px] leading-5">
            {pendingCount}
          </span>
        )}
      </button>
      {open && (
        <div
          // Close after following a link — but not for the Sign out form, which must stay on the
          // page until it submits (closing it first silently cancelled the sign-out).
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) setOpen(false);
          }}
          className="absolute right-0 mt-2 w-56 bg-saddle-paper border border-saddle-line rounded-lg shadow-lg py-1 z-50 text-saddle-ink"
        >
          <div className={heading}>Selling</div>
          <Link href="/dashboard" className={item}>My listings</Link>
          <Link href="/dashboard/listings/new" className={item}>Sell a saddle</Link>
          <Link href="/sales" className={item}>Sales</Link>

          <div className={heading}>Buying</div>
          <Link href="/lists" className={item}>My lists</Link>
          <Link href="/orders" className={item}>Orders</Link>
          <Link href="/messages" className={item}>Messages</Link>

          {isImporter && (
            <>
              <div className={heading}>Importing</div>
              <Link href="/imports/new" className={item}>Add a saddle you found</Link>
              <Link href="/imports" className={item}>My imports</Link>
            </>
          )}

          {isAdmin && (
            <>
              <div className={heading}>Admin</div>
              <Link href="/admin" className={item}>Admin dashboard</Link>
              <Link href="/admin/listings" className={item}>All listings</Link>
              <Link href="/admin/listings?status=draft" className={`${item} flex justify-between`}>
                Review listings
                {pendingCount > 0 && <span className="text-saddle-green font-semibold">{pendingCount}</span>}
              </Link>
            </>
          )}

          <div className="border-t border-saddle-line my-1" />
          <Link href="/account/notifications" className={item}>Notifications</Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className={`${item} w-full text-left`}>Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
