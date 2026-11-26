import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/** Cookie an admin sets to see the site as a regular member ("View as member"). Only ever read for
 *  real admins, so it can't give anyone more access, only less. */
export const VIEW_AS_COOKIE = 'su_view_as';

function viewingAsMember() {
  try {
    return cookies().get(VIEW_AS_COOKIE)?.value === 'member';
  } catch {
    return false; // outside a request (no cookies available)
  }
}

/** Roles from a profile row, honouring "View as member" for admins. */
export function rolesFor(profile: { is_admin?: boolean | null; is_importer?: boolean | null } | null | undefined) {
  const realAdmin = !!profile?.is_admin;
  const asMember = realAdmin && viewingAsMember();
  const isAdmin = realAdmin && !asMember;
  return {
    isAdmin,
    // Admins can do everything importers can. A previewing admin is a plain member.
    isImporter: isAdmin || (!asMember && !!profile?.is_importer),
    /** Really an admin, whatever view they're using (for the switch itself). */
    realAdmin,
    viewingAsMember: asMember
  };
}

/** The signed-in user and what they're allowed to do. Reads only their own profile. */
export async function getViewer() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false, isImporter: false, realAdmin: false, viewingAsMember: false };
  const { data: profile } = await supabase.from('profiles').select('is_admin, is_importer').eq('id', user.id).single();
  return { supabase, user, ...rolesFor(profile) };
}
