// What each member wants to hear about, and how. Stored in profiles.notification_prefs as flat
// on/off flags; a missing flag means on. Order emails have no flag: they're always sent.
// Texts also need a verified phone and text consent (see messaging.ts), on top of these flags.

export const PREF_KEYS = ['messages_email', 'messages_sms', 'orders_sms', 'listings_email', 'matches_email'] as const;
export type PrefKey = (typeof PREF_KEYS)[number];
export type Prefs = Record<PrefKey, boolean>;

export const DEFAULT_PREFS: Prefs = {
  messages_email: true,
  messages_sms: true,
  orders_sms: true,
  listings_email: true,
  matches_email: true
};

export function toPrefs(raw: unknown): Prefs {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_PREFS };
  for (const k of PREF_KEYS) if (typeof r[k] === 'boolean') out[k] = r[k] as boolean;
  return out;
}

/**
 * Prefs for these members. Falls back to the defaults if the lookup fails (for example before the
 * notification_prefs migration has run), so a missing column never stops a message going out.
 */
export async function readPrefs(admin: any, ids: string[]): Promise<Map<string, Prefs>> {
  const out = new Map<string, Prefs>(ids.map((id) => [id, { ...DEFAULT_PREFS }]));
  if (!ids.length) return out;
  const { data, error } = await admin.from('profiles').select('id, notification_prefs').in('id', ids);
  if (error) return out;
  for (const row of data ?? []) out.set(row.id, toPrefs(row.notification_prefs));
  return out;
}
