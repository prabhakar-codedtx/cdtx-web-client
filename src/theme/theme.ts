/**
 * Width thresholds shared by every responsive decision in the app —
 * `useBreakpoint` (lib/device/useBreakpoint.ts) for layout-affecting JS
 * (card counts per row) and any styled-component media query that needs the
 * same cutoff. One source of truth so a tablet never gets treated as mobile
 * by one piece of code and desktop by another.
 */
export const BREAKPOINT = {
  tablet: 768,
  desktop: 1200,
} as const;

/** Design tokens shared by every styled-component. One source of truth for
 * spacing/color instead of magic numbers scattered per file. */
export const theme = {
  color: {
    background: '#ffffff',
    surface: '#f5f5f7',
    surfaceRaised: '#e9e9ee',
    text: '#0b0b0f',
    textMuted: '#65656f',
    accent: '#e8433f',
    border: 'rgba(0, 0, 0, 0.08)',
  },
  space: (n: number) => `${n * 8}px`,
  radius: { sm: '4px', md: '8px', lg: '14px' },
  /** `TopNav`'s own fixed height, in px (not a CSS string — `HomeScreen`
   * needs the bare number to compute a fallback content offset for a tab
   * whose first row isn't a hero: the hero itself is meant to run full
   * `100vh` *under* the nav, but a plain rail's title/cards need this much
   * clearance instead of sitting half-hidden behind a `position: fixed`
   * bar. One source of truth so the two never drift apart. */
  navHeightPx: 64,
  font: {
    family: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
} as const;

export type AppTheme = typeof theme;
