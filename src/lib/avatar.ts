// Member headshots. A photo someone uploads on /account/profile is kept on their sign-in record
// (app_metadata.avatar_url, which only the server can write). Without one we use the photo Google
// gave us when they signed in with Google, and without that, their initials.
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';

export function avatarUrlFor(user: Pick<User, 'app_metadata' | 'user_metadata'> | null | undefined): string | null {
  if (!user) return null;
  const pick = (v: unknown) => (typeof v === 'string' && /^https:\/\//.test(v) ? v : null);
  return pick(user.app_metadata?.avatar_url) ?? pick(user.user_metadata?.avatar_url) ?? pick(user.user_metadata?.picture);
}

/** True when they uploaded their own photo (rather than using Google's or none). */
export const hasUploadedAvatar = (user: Pick<User, 'app_metadata'> | null | undefined) =>
  typeof user?.app_metadata?.avatar_url === 'string';

export function initialsOf(name: string | null | undefined, email?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length) return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  return (email?.[0] ?? '?').toUpperCase();
}

/** A seller's public face: first name and headshot. Profiles are private, so read with the service key
 *  and return only what's safe to show on a listing. */
export async function getSellerFace(sellerId: string | null | undefined) {
  if (!sellerId) return null;
  const admin = createAdminClient();
  const [{ data: profile }, { data: auth }] = await Promise.all([
    admin.from('profiles').select('full_name, created_at').eq('id', sellerId).maybeSingle(),
    admin.auth.admin.getUserById(sellerId)
  ]);
  if (!profile) return null;
  const fullName = profile.full_name?.trim() || null;
  return {
    id: sellerId,
    fullName,
    firstName: fullName?.split(/\s+/)[0] ?? 'The seller',
    initials: initialsOf(fullName),
    avatarUrl: avatarUrlFor(auth?.user),
    memberSince: profile.created_at as string
  };
}

export type SellerChip = { firstName: string; initials: string; avatarUrl: string | null };

/** First name + headshot for many sellers at once (for saddle cards). */
export async function getSellerChips(ids: (string | null | undefined)[]): Promise<Record<string, SellerChip>> {
  const unique = Array.from(new Set(ids.filter((id): id is string => !!id)));
  if (!unique.length) return {};
  const admin = createAdminClient();
  const [{ data: profiles }, users] = await Promise.all([
    admin.from('profiles').select('id, full_name').in('id', unique),
    Promise.all(unique.map((id) => admin.auth.admin.getUserById(id).then((r) => r.data?.user ?? null).catch(() => null)))
  ]);
  const out: Record<string, SellerChip> = {};
  for (const p of profiles ?? []) {
    const name = p.full_name?.trim() || null;
    out[p.id] = {
      firstName: name?.split(/\s+/)[0] ?? 'Seller',
      initials: initialsOf(name),
      avatarUrl: avatarUrlFor(users.find((u) => u?.id === p.id))
    };
  }
  return out;
}
