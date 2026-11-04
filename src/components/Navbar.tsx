import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import AccountMenu from './AccountMenu';

export default async function Navbar() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <nav className="sticky top-0 z-50 bg-saddle-cream/90 backdrop-blur-md border-b border-saddle-line">
      <div className="max-w-[1200px] mx-auto px-[18px] py-[14px] sm:px-8 sm:py-4 flex flex-wrap sm:flex-nowrap gap-2.5 items-center justify-between">
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="SaddleUp" className="h-11 w-auto block mix-blend-multiply" />
        </Link>
        <div className="flex flex-wrap items-center gap-4 sm:gap-[30px] text-[13px] sm:text-[13.5px] tracking-[0.03em] text-saddle-nav">
          <Link href="/saddles" className="hover:text-saddle-brown">Browse Saddles</Link>
          <Link href="/match" className="hover:text-saddle-brown">Find My Fit</Link>
          <Link href="/dashboard" className="hover:text-saddle-brown">Sell a Saddle</Link>
          {user ? (
            <AccountMenu />
          ) : (
            <Link
              href="/auth/login"
              className="text-[13px] font-semibold text-saddle-brown border border-saddle-tan-line px-[18px] py-[9px] rounded-sm whitespace-nowrap transition-colors hover:bg-saddle-brown hover:text-saddle-cream hover:border-saddle-brown"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
