import { useSyncExternalStore } from 'react';

/**
 * The profiles made on this browser: a name and the kind (the CMS's profile type `key`) each, and
 * which one is watching. There are no accounts yet, so they live in this browser only. The chosen
 * kind is what the client sends as `profileType` (`client.ts`); the server does all the filtering.
 */
export interface LocalProfile {
  /** Sent as `X-Profile-Id`: each profile keeps its own Continue Watching. */
  id: string;
  name: string;
  /** A `profileTypes[].key` from the launch config. */
  type: string;
}

interface State {
  profiles: LocalProfile[];
  activeId: string | null;
}

const KEY = 'cdtx.profiles';
const ACTIVE = 'cdtx.activeProfile';

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // An old browser without randomUUID: 32 random hex digits in UUID groups.
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const valid = (p: unknown): p is LocalProfile =>
  !!p &&
  typeof p === 'object' &&
  typeof (p as LocalProfile).id === 'string' &&
  /^[A-Za-z0-9-]{8,64}$/.test((p as LocalProfile).id) &&
  typeof (p as LocalProfile).name === 'string' &&
  typeof (p as LocalProfile).type === 'string';

function read(): State {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    const profiles = Array.isArray(raw) ? raw.filter(valid) : [];
    const active = localStorage.getItem(ACTIVE);
    return { profiles, activeId: profiles.some((p) => p.id === active) ? active : null };
  } catch {
    return { profiles: [], activeId: null }; // storage blocked or unreadable: no profiles
  }
}

let state: State = read();
const listeners = new Set<() => void>();

function set(next: State): void {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next.profiles));
    if (next.activeId) localStorage.setItem(ACTIVE, next.activeId);
    else localStorage.removeItem(ACTIVE);
  } catch {
    // Storage blocked (private mode): the profiles last for this visit.
  }
  listeners.forEach((l) => l());
}

export const getProfiles = (): State => state;

export function subscribeProfiles(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The profiles and the one watching, re-read when either changes. */
export function useProfiles(): State {
  return useSyncExternalStore(subscribeProfiles, getProfiles, getProfiles);
}

export const activeProfile = (): LocalProfile | null =>
  state.profiles.find((p) => p.id === state.activeId) ?? null;

/**
 * Why a name cannot be used, or null. Names are kept short and are unique on the device. When a
 * profile is being edited, `exceptId` is that profile: keeping its own name is not a clash.
 */
export function nameProblem(
  name: string,
  profiles: readonly LocalProfile[],
  exceptId?: string,
): string | null {
  const n = name.trim();
  if (!n) return 'Enter a name.';
  if (n.length > 20) return 'Use 20 characters or fewer.';
  if (profiles.some((p) => p.id !== exceptId && p.name.trim().toLowerCase() === n.toLowerCase()))
    return 'A profile with this name already exists.';
  return null;
}

/** Adds a profile and makes it the one watching. Returns it, or null when the name is not allowed. */
export function addProfile(name: string, type: string): LocalProfile | null {
  if (nameProblem(name, state.profiles)) return null;
  const profile: LocalProfile = { id: newId(), name: name.trim(), type };
  set({ profiles: [...state.profiles, profile], activeId: profile.id });
  return profile;
}

export function chooseProfile(id: string): void {
  if (state.profiles.some((p) => p.id === id)) set({ ...state, activeId: id });
}

/** Changes a profile's name and/or kind. Returns it, or null when it is not here or the name is not allowed. */
export function updateProfile(id: string, change: { name?: string; type?: string }): LocalProfile | null {
  const current = state.profiles.find((p) => p.id === id);
  if (!current) return null;
  const name = change.name === undefined ? current.name : change.name.trim();
  if (nameProblem(name, state.profiles, id)) return null;
  const next: LocalProfile = { ...current, name, type: change.type ?? current.type };
  set({ ...state, profiles: state.profiles.map((p) => (p.id === id ? next : p)) });
  return next;
}

/**
 * Takes a profile off this browser. If it was the one watching, nobody is: the viewer picks again.
 * (What the server keeps for it, such as Continue Watching, is not touched: it is kept by the profile's id.)
 */
export function removeProfile(id: string): void {
  if (!state.profiles.some((p) => p.id === id)) return;
  set({
    profiles: state.profiles.filter((p) => p.id !== id),
    activeId: state.activeId === id ? null : state.activeId,
  });
}
