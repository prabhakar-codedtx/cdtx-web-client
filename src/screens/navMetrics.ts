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

/** A sidebar's numbers, as the CMS sets them (an older server sends only `size` and `collapsed`). */
export interface SidebarMetrics {
  /** Stacked on the storefront (`sidebarLayer: overlay`), not beside it. */
  overlay: boolean;
  /** Opens while the pointer or focus is in it; closed (icons only) otherwise. */
  expandable: boolean;
  /** Width open (with names) and closed (icons only), px. */
  openWidth: number;
  closedWidth: number;
  /** Where the storefront's content starts from the left edge, px. 0 when nothing is stacked. */
  contentInset: number;
  animationMs: number;
}

export function sidebarMetrics(style: NavBarStyle | null): SidebarMetrics | null {
  if (!style || style.placement !== 'left') return null;
  // An older server has no layer: its sidebar was always beside the page.
  const overlay = style.sidebarLayer === 'overlay';
  const expandable = Boolean(style.expandOnFocus);
  const closedWidth = style.collapsedSize ?? 96;
  const openWidth = style.size;
  // The server works the inset out (`contentInset`); the same rule if it did not send it.
  const fallback = !overlay ? 0 : expandable || style.collapsed ? closedWidth : openWidth;
  return {
    overlay,
    expandable,
    openWidth,
    closedWidth,
    contentInset: overlay ? (style.contentInset ?? fallback) : 0,
    animationMs: style.animationMs ?? 180,
  };
}

/**
 * The room a screen leaves at its left for a sidebar stacked on it: its content (the rails, the
 * hero's banner, text and dots) starts here, while backgrounds and the hero's artwork run under it.
 * A sidebar beside the page takes its room itself (the page is moved), so this is 0 then.
 */
export function navLeftInset(style: NavBarStyle | null): number {
  return sidebarMetrics(style)?.contentInset ?? 0;
}
