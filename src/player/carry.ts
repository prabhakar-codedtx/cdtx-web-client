/**
 * One video, carried from screen to screen: the hero's playing preview goes on playing in the title's
 * detail page instead of the page starting it again (Hotstar's way). The video element itself moves: the
 * screen it plays on hands it over (`offer`), the next screen showing the same title's same video takes it
 * (`adopt`) and puts it in its own box, so it never stops or starts over. When that screen goes (the
 * details dialog closed), the video goes back to the screen it came from (`giveBack`), still playing.
 *
 * Only the layers around it change (each screen draws its own picture, shade and metadata); the video is
 * the same element at the same second, with the same sound.
 */

/** The key a video is handed to the player under: the player plays the title's own stream, so any of the
 * title's videos carries into it (the player starts its stream at the matching second, then takes over). */
export const playerCarryKey = (titleId: string) => `player:${titleId}`;

export interface Carried {
  el: HTMLVideoElement;
  /** Lets go of its source (an hls.js instance, or the address): called when the video is done with. */
  release: () => void;
  /** Its second when it was handed on (the tap): where the next screen measures how far it went on from. */
  offeredAt?: number;
}

interface Offer {
  carried: Carried;
  /** The screen it came from takes it back (when the next screen is done with it). Null: that screen is
   * gone, so the video is done with when the next one is. */
  reclaim: ((c: Carried) => void) | null;
  /** Tells the screen it came from that another took it. */
  onAdopted: () => void;
  timer: number;
}

/** How long a handed-over video waits for the next screen (its page may still be loading). */
const WAIT_MS = 8000;

const offers = new Map<string, Offer>();
const owners = new Map<string, (c: Carried) => void>();

/** Hands the playing video over to the next screen that shows `key` (the title and its video's address).
 * Until one takes it, it plays where it is; none within a few seconds: it simply stays. */
export function offer(key: string, carried: Carried, reclaim: (c: Carried) => void, onAdopted: () => void) {
  withdraw(key);
  carried.offeredAt = carried.el.currentTime;
  // While the next screen loads, the video waits in the page, playing, exactly where it was: the screen it
  // came from may go at once (a full page), and a video taken out of the page stops.
  wait(carried.el);
  const timer = window.setTimeout(() => {
    const o = offers.get(key);
    if (o?.carried !== carried) return;
    offers.delete(key);
    // Nobody took it: back where it came from, or done with when that screen is gone too.
    if (o.reclaim) o.reclaim(carried);
    else done(carried);
    tidy();
  }, WAIT_MS);
  offers.set(key, { carried, reclaim, onAdopted, timer });
}

/** The layer a handed-over video waits in: fixed over the box it was in, under any dialog. */
function wait(el: HTMLVideoElement) {
  const r = el.getBoundingClientRect();
  const box = document.createElement('div');
  box.dataset.carryWait = '';
  Object.assign(box.style, {
    position: 'fixed',
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    zIndex: '999',
    pointerEvents: 'none',
    overflow: 'hidden',
  });
  document.body.appendChild(box);
  box.appendChild(el);
}

/** Waiting layers whose video has moved on. */
function tidy() {
  document.querySelectorAll<HTMLElement>('[data-carry-wait]').forEach((b) => {
    if (!b.firstElementChild) b.remove();
  });
}

/** A video is waiting for `key` (looked at, not taken). */
export function isOffered(key: string): boolean {
  return offers.has(key);
}

/** Takes the video handed over for `key`, if there is one: the caller puts it in its own box. */
export function adopt(key: string): Carried | null {
  const o = offers.get(key);
  if (!o) return null;
  window.clearTimeout(o.timer);
  offers.delete(key);
  if (o.reclaim) owners.set(key, o.reclaim);
  o.onAdopted();
  // Tidied once the caller has moved it into its own box.
  queueMicrotask(tidy);
  return o.carried;
}

/** The screen that handed `el` on (under any key: its page's or the player's) is going before anyone took
 * it: the video goes on waiting for the next screen, and is done with if none comes. True when it waits. */
export function orphan(el: HTMLVideoElement): boolean {
  for (const o of offers.values()) {
    if (o.carried.el !== el) continue;
    o.reclaim = null;
    return true;
  }
  return false;
}

/** The screen that took `key`'s video is done with it: back to the screen it came from, when that is still
 * there. False: nobody wants it back, the caller lets it go. */
export function giveBack(key: string, carried: Carried): boolean {
  const reclaim = owners.get(key);
  owners.delete(key);
  if (!reclaim) return false;
  reclaim(carried);
  tidy();
  return true;
}

/** The screen a video came from is gone: it is not given back (under any key). */
export function forget(reclaim: (c: Carried) => void) {
  for (const [key, r] of owners) if (r === reclaim) owners.delete(key);
  for (const o of offers.values()) if (o.reclaim === reclaim) o.reclaim = null;
}

/** Takes back an offer nobody took yet. */
export function withdraw(key: string) {
  const o = offers.get(key);
  if (!o) return;
  window.clearTimeout(o.timer);
  offers.delete(key);
}

/** A video nobody shows any more: stopped, its source let go, out of the page. */
export function done(carried: Carried) {
  carried.release();
  carried.el.pause();
  carried.el.removeAttribute('src');
  carried.el.load();
  carried.el.remove();
  tidy();
}
