import { useEffect, useState } from 'react';

/**
 * How near counts as near: one screen height above or below. A rail (and the next rows) is asked for
 * one screen ahead of the viewer, whatever the screen: a phone's few hundred pixels or a TV's thousand.
 */
export const NEAR = '100% 0px';

/**
 * True once the element has entered the viewport (or come within
 * `rootMargin`), and stays true — a rail that's been loaded should never
 * unload just because the user scrolled past it.
 *
 * Exists to fix a real failure mode found in manual testing: firing every
 * rail's item request at once (one Home screen here had 20 rails) blew past
 * the browser's per-origin connection limit and the backend's shared-DB
 * concurrency, so most of them timed out even at a generous 20s. Loading a
 * rail only once it's about to be visible keeps concurrent requests to a
 * handful, which is also just how every real OTT app behaves — nobody
 * fetches row 18 before the user has scrolled past row 3.
 */
export function useInView<T extends HTMLElement>({
  rootMargin = NEAR,
  once = true,
  enabled = true,
}: {
  rootMargin?: string;
  /**
   * `true` (the default): true from the first time it comes near, for good (a rail asks for its titles
   * once). `false`: true only while it is near (the end of the page: more rows each time it is reached).
   */
  once?: boolean;
  /**
   * Watch only once this is true: the element has its real size. A rail is drawn before its width is
   * known, as just its title line; watched then, all twenty rails of a page fit in one screen and every
   * one of them would ask for its titles at once.
   */
  enabled?: boolean;
} = {}): [(el: T | null) => void, boolean] {
  // The element is kept as state, not in a ref: a component that draws nothing at first (a rail
  // whose titles are not known yet) and its element later must still be watched once it appears.
  const [el, setEl] = useState<T | null>(null);
  const [inView, setInView] = useState(false);
  const done = once && inView;

  useEffect(() => {
    if (done || !el || !enabled) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (once) {
          if (entry.isIntersecting) setInView(true);
        } else {
          setInView(entry.isIntersecting);
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [el, done, once, rootMargin, enabled]);

  return [setEl, inView];
}
