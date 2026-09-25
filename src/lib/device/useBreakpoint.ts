import { useEffect, useState } from 'react';
import { BREAKPOINT } from '@/theme/theme';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

function resolve(width: number): Breakpoint {
  if (width >= BREAKPOINT.desktop) return 'desktop';
  if (width >= BREAKPOINT.tablet) return 'tablet';
  return 'mobile';
}

/**
 * The client-side half of device-aware layout referenced (but never built)
 * in `deviceContext.ts`: the delivery API only resolves a per-device
 * `page_size` for `dt=web`/`dt=androidtv` (see that file's docstring) — it
 * has no tablet/mobile bucket at all, so a phone gets back the same
 * card-count the server picked for a desktop browser. `cardsPerRow.ts`
 * clamps that server value down using this hook rather than ignoring it,
 * so a real per-device column count still comes from the server wherever it
 * *can* resolve one — this only fixes the cases it can't.
 *
 * `matchMedia` + `change` listeners, not a resize-event width poll: a
 * `MediaQueryList` only fires when the query's truth value actually flips
 * (i.e. exactly at the breakpoint crossings), so this doesn't re-render on
 * every pixel of a window drag the way a raw `resize` listener would.
 */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
    typeof window === 'undefined' ? 'desktop' : resolve(window.innerWidth),
  );

  useEffect(() => {
    const tabletQuery = window.matchMedia(`(min-width: ${BREAKPOINT.tablet}px)`);
    const desktopQuery = window.matchMedia(`(min-width: ${BREAKPOINT.desktop}px)`);

    const update = () => setBreakpoint(resolve(window.innerWidth));
    update();

    tabletQuery.addEventListener('change', update);
    desktopQuery.addEventListener('change', update);
    return () => {
      tabletQuery.removeEventListener('change', update);
      desktopQuery.removeEventListener('change', update);
    };
  }, []);

  return breakpoint;
}
