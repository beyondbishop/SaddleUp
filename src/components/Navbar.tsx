import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AccountMenu from './AccountMenu';
import SignInLink from './SignInLink';
import { avatarUrlFor, initialsOf } from '@/lib/avatar';

export default async function Navbar() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Admins get an Admin section and a count of listings waiting for review.
  let isAdmin = false;
  let isImporter = false;
  let pendingCount = 0;
  let initials = '?';
  // Things waiting on this person: the number on their headshot.
  const counts = { messages: 0, toShip: 0, toInspect: 0 };
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('full_name, is_admin, is_importer').eq('id', user.id).single();
    isAdmin = !!profile?.is_admin;
    isImporter = isAdmin || !!profile?.is_importer;
    initials = initialsOf(profile?.full_name, user.email);
    const n = (r: { count: number | null }) => r.count ?? 0;
    const [messages, toShip, toInspect, pending] = await Promise.all([
      // Unread messages from the other person (only their own conversations are visible to them).
      supabase.from('messages').select('id', { count: 'exact', head: true }).is('read_at', null).neq('sender_id', user.id),
      // Sales they still need to ship.
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .eq('seller_id', user.id).eq('status', 'paid').is('shipped_at', null),
      // Saddles delivered to them that they haven't kept or raised a problem about yet.
      supabase.from('orders').select('id', { count: 'exact', head: true })
        .eq('buyer_id', user.id).eq('status', 'paid').not('delivered_at', 'is', null)
        .is('kept_at', null).is('confirmed_at', null).is('issue_type', null),
      isAdmin
        ? supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'draft')
        : Promise.resolve({ count: 0 })
    ]);
    counts.messages = n(messages);
    counts.toShip = n(toShip);
    counts.toInspect = n(toInspect);
    pendingCount = n(pending);
  }

  return (
    <nav className="sticky top-0 z-50 bg-saddle-cream/90 backdrop-blur-md border-b border-saddle-line">
      <div className="max-w-[1200px] mx-auto px-[18px] py-[14px] sm:px-8 sm:py-4 flex flex-wrap sm:flex-nowrap gap-2.5 items-center justify-between">
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="SaddleUp" className="h-11 w-auto block mix-blend-multiply" />
        </Link>
        <div className="flex flex-wrap items-center gap-4 sm:gap-[30px] text-[13px] sm:text-[13.5px] tracking-[0.03em] text-saddle-nav">
          <Link href="/saddles" className="hover:text-saddle-brown">Browse Saddles</Link>
          {/* Find My Fit (/match) is hidden until it's ready; the page still works. */}
          <Link href="/dashboard" className="hover:text-saddle-brown">Sell a Saddle</Link>
          <Link href="/guides" className="hover:text-saddle-brown">Guides</Link>
          <Link href="/about" className="hover:text-saddle-brown">Our Story</Link>
          {user ? (
            <AccountMenu isAdmin={isAdmin} isImporter={isImporter} pendingCount={pendingCount}
              avatarUrl={avatarUrlFor(user)} initials={initials} counts={counts} />
          ) : (
            <SignInLink
              className="text-[13px] font-semibold text-saddle-brown border border-saddle-tan-line px-[18px] py-[9px] rounded-sm whitespace-nowrap transition-colors hover:bg-saddle-brown hover:text-saddle-cream hover:border-saddle-brown"
            >
              Sign In
            </SignInLink>
          )}
        </div>
      </div>
    </nav>
  );
}
