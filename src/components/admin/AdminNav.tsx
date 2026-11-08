'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/listings', label: 'Listings' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/rewards', label: 'Rewards' },
  { href: '/admin/emails', label: 'Emails' },
  { href: '/admin/quick-add', label: 'Quick add' }
];

export default function AdminNav({ pendingCount }: { pendingCount: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto border-b border-saddle-line -mx-1 px-1">
      {TABS.map((t) => {
        const active = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap px-3 py-2 text-sm border-b-2 -mb-px ${
              active ? 'border-saddle-brown text-saddle-ink font-semibold' : 'border-transparent text-saddle-muted hover:text-saddle-ink'
            }`}
          >
            {t.label}
            {t.href === '/admin/listings' && pendingCount > 0 && (
              <span className="ml-1.5 inline-block min-w-5 px-1 rounded-full bg-saddle-green text-saddle-cream text-[11px] leading-5 text-center">
                {pendingCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
