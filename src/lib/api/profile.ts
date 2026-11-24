import { activeProfile, newId } from '@/lib/profiles/profiles';

/**
 * The viewer, for the API: the profile watching (one made with "+", `lib/profiles`), else a random
 * id made once per browser and kept, sent as `X-Profile-Id` on every call (`client.ts`). It is what
 * the server keeps Continue Watching by; there are no accounts yet. Never put in a URL.
 */

const KEY = 'cdtx.profileId';
let kept: string | null = null;

/** The id of the profile watching, else this browser's own id, made on first use. */
export function profileId(): string {
  const chosen = activeProfile();
  if (chosen) return chosen.id; // each profile keeps its own Continue Watching
  if (kept) return kept;
  try {
    kept = localStorage.getItem(KEY);
    if (!kept || !/^[A-Za-z0-9-]{8,64}$/.test(kept)) {
      kept = newId();
      localStorage.setItem(KEY, kept);
    }
  } catch {
    // Storage blocked (private mode): one id for this visit.
    kept = kept ?? newId();
  }
  return kept;
}
