import { useLayoutEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setNavShown } from '@/app/uiSlice';
import type { NavBarStyle } from '@/lib/api/types';

/**
 * Whether the tab bar (top bar, bottom bar, sidebar or dropdown) is drawn on the screen open now. The CMS
 * decides it and the server sends the answer: a page's `nav.show` (Page Builder -> Sidebar), the grid a
 * rail opens `gridNav.show` (Rails -> Navigation). The screen on show reports it here (`useShowNav`);
 * the bar and the room the screens keep for it follow (`useNavShown`). The player never shows the bar.
 */
export function useNavShown(): boolean {
  return useAppSelector((s) => s.ui.navShown);
}

/** The screen on show says whether the bar is drawn over it; leaving, it gives the bar back. `active`
 * false: this screen does not decide (a screen inside the details dialog: the screen behind it does). */
export function useShowNav(show: boolean, active = true): void {
  const dispatch = useAppDispatch();
  useLayoutEffect(() => {
    if (!active) return;
    dispatch(setNavShown(show));
    return () => {
      dispatch(setNavShown(true));
    };
  }, [show, active, dispatch]);
}

/** Before the server's answer arrives (or from an older server that sends none): the bar's own defaults,
 * as the Navigation design publishes them (`showOn`); shown when it sends none. */
export function defaultShown(style: NavBarStyle | null, kind: 'detail' | 'grid'): boolean {
  return style?.showOn?.[kind] ?? true;
}
