'use client';
// Which saddles the buyer has saved (on any active list), shared by every heart on the page,
// plus which saddle the list picker is open for. One fetch per page load, not one per heart.
import { useSyncExternalStore } from 'react';

type State = {
  loaded: boolean;
  signedIn: boolean;
  ids: Set<string>;
  pickerFor: string | null;
};

let state: State = { loaded: false, signedIn: false, ids: new Set(), pickerFor: null };
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function loadSaved(force = false) {
  if (loading && !force) return loading;
  loading = fetch('/api/lists/saved', { cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => set({ loaded: true, signedIn: !!d.signedIn, ids: new Set(d.listingIds ?? []) }))
    .catch(() => set({ loaded: true }));
  return loading;
}

export function setSaved(listingId: string, saved: boolean) {
  const ids = new Set(state.ids);
  saved ? ids.add(listingId) : ids.delete(listingId);
  set({ ids });
}

export const openPicker = (listingId: string) => set({ pickerFor: listingId });
export const closePicker = () => set({ pickerFor: null });

export function useSavedState() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
