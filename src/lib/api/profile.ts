/**
 * The viewer, for the API: a random id made once per browser and kept, sent as `X-Profile-Id` on
 * every call (`client.ts`). It is what the server keeps Continue Watching by; there are no accounts
 * yet. Never put in a URL.
 */

const KEY = 'cdtx.profileId';
let kept: string | null = null;

function fresh(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // An old browser without randomUUID: 32 random hex digits in UUID groups.
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** This browser's profile id, made on first use. */
export function profileId(): string {
  if (kept) return kept;
  try {
    kept = localStorage.getItem(KEY);
    if (!kept || !/^[A-Za-z0-9-]{8,64}$/.test(kept)) {
      kept = fresh();
      localStorage.setItem(KEY, kept);
    }
  } catch {
    // Storage blocked (private mode): one id for this visit.
    kept = kept ?? fresh();
  }
  return kept;
}
