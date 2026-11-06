import type { NavBarStyle } from '@/lib/api/types';

/** The tab bar floats over the top of the screen at this height; a screen with no hero starts under it. */
export const NAV_HEIGHT = 56;

/**
 * The room a screen leaves at its top for the tab bar: the CMS design's bar height for a top bar or
 * a dropdown, none for a sidebar or a bottom bar (they take their room at the side or the bottom),
 * and `NAV_HEIGHT` for the client's own bar (no design from the server).
 */
export function navTopRoom(style: NavBarStyle | null): number {
  if (!style) return NAV_HEIGHT;
  return style.placement === 'top' || style.placement === 'dropdown' ? style.size : 0;
}
