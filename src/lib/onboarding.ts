// Onboarding after sign-up (/welcome): why someone joined, what they ride, plus photo, ZIP and phone.
import type { Discipline } from '@/lib/types';

export const INTENTS = ['buying', 'selling', 'both'] as const;
export type Intent = (typeof INTENTS)[number];

export const INTENT_LABELS: Record<Intent, string> = {
  buying: 'Looking for a saddle',
  selling: 'Selling a saddle',
  both: 'Both'
};

export const ALL_DISCIPLINES: Discipline[] = ['hunter_jumper', 'dressage', 'eventing', 'all_purpose', 'pony_child', 'western', 'endurance'];

/** Where to go after onboarding: their original destination, or a start that fits why they came. */
export function afterOnboarding(next: string | null, intent: Intent | null): string {
  if (next && next !== '/dashboard') return next;
  if (intent === 'selling') return '/dashboard/listings/new';
  if (intent === 'buying') return '/saddles';
  return '/dashboard';
}

/** Sign-up and sign-in send people here first; /welcome passes them straight on if they're done. */
export const welcomeUrl = (next: string) => `/welcome?next=${encodeURIComponent(next)}`;
