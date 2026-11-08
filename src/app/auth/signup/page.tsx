'use client';

import { Suspense } from 'react';
import AuthPanels from '@/components/AuthPanels';

// Create an account (left) and sign in (right) on one page; see AuthPanels.
export default function SignupPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center">Loading…</div>}>
      <AuthPanels focus="signup" />
    </Suspense>
  );
}
