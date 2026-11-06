import { createClient } from '@/lib/supabase/server';

/** The signed-in user and what they're allowed to do. Reads only their own profile. */
export async function getViewer() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false, isImporter: false };
  const { data: profile } = await supabase.from('profiles').select('is_admin, is_importer').eq('id', user.id).single();
  const isAdmin = !!profile?.is_admin;
  // Admins can do everything importers can.
  return { supabase, user, isAdmin, isImporter: isAdmin || !!profile?.is_importer };
}
