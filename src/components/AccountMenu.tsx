'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Avatar from './Avatar';

const item = 'block px-4 py-2 text-sm hover:bg-saddle-cream';
const heading = 'px-4 pt-2 pb-1 font-mono text-[10px] tracking-[0.16em] uppercase text-saddle-gold';

type Counts = { messages: number; toShip: number; toInspect: number };

const Badge = ({ n }: { n: number }) =>
  n > 0 ? <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-700 text-white text-[11px] leading-5 text-center font-semibold">{n}</span> : null;

export default function AccountMenu({ isAdmin, isImporter = false, pendingCount = 0, avatarUrl = null, initials = '?', counts = { messages: 0, toShip: 0, toInspect: 0 } }: {
  isAdmin: boolean; isImporter?: boolean; pendingCount?: number; avatarUrl?: string | null; initials?: string; counts?: Counts;
}) {
  const total = counts.messages + counts.toShip + counts.toInspect + (isAdmin ? pendingCount : 0);
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
        aria-label={`Your account${total ? `, ${total} notification${total === 1 ? '' : 's'}` : ''}`}
        className="relative block rounded-full ring-1 ring-saddle-tan-line hover:ring-2 hover:ring-saddle-brown transition-shadow"
      >
        <Avatar url={avatarUrl} initials={initials} size={38} />
        {total > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-700 text-white text-[11px] leading-5 font-semibold text-center ring-2 ring-saddle-cream">
            {total > 99 ? '99+' : total}
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
          <Link href="/sales" className={`${item} flex justify-between items-center`}>
            Sales{counts.toShip > 0 && <span className="text-xs text-red-700 font-semibold">{counts.toShip} to ship</span>}
          </Link>

          <div className={heading}>Buying</div>
          <Link href="/lists" className={item}>My lists</Link>
          <Link href="/orders" className={`${item} flex justify-between items-center`}>
            Orders{counts.toInspect > 0 && <span className="text-xs text-red-700 font-semibold">{counts.toInspect} to inspect</span>}
          </Link>
          <Link href="/messages" className={`${item} flex justify-between items-center`}>Messages <Badge n={counts.messages} /></Link>

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
          <Link href="/account/profile" className={item}>Your profile</Link>
          <Link href="/account/notifications" className={item}>Notification settings</Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className={`${item} w-full text-left`}>Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
