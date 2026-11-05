'use client';
import { goToSignIn } from '@/lib/return-to';

/** "Sign in" that returns to the current page afterwards (plain link if JavaScript is off). */
export default function SignInLink({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <a
      href="/auth/login"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        const here = window.location.pathname + window.location.search;
        goToSignIn(here.startsWith('/auth/') ? '/' : here);
      }}
    >
      {children}
    </a>
  );
}
