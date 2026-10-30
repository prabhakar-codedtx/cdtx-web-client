import { useEffect, useState } from 'react';

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
export function useInView<T extends HTMLElement>(
  rootMargin = '600px 0px',
): [(el: T | null) => void, boolean] {
  // The element itself, kept as state (a callback ref): when it appears after the first render, or
  // is replaced, it is watched. (A ref object read once on mount missed such an element, and the
  // rail then never loaded: e.g. Continue Watching on coming back from the player.)
  const [el, setEl] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView || !el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [el, inView, rootMargin]);

  return [setEl, inView];
}
