import { useCallback } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { openShare, showToast } from '@/app/uiSlice';
import { hasDetailPage, shareLink } from '@/lib/api/endpoints';
import { toggleWatchlist } from '@/app/pagesSlice';
import type { Block, Fill, Rail, SeeAllPageDesign, Title } from '@/lib/api/types';

/** A See all's storefront (`seeAll.tap` of type `page`): its slug, read from the address the server
 * sent (`…/storefront/{product}/{slug}?…`). Null when there is none. */
export function storefrontOf(target: string | null | undefined): string | null {
  if (!target) return null;
  try {
    const parts = new URL(target, 'http://api.invalid').pathname.split('/').filter(Boolean);
    const at = parts.indexOf('storefront');
    const slug = at >= 0 ? parts[at + 2] : undefined;
    return slug && /^[a-z0-9-]+$/.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

/**
 * What a tap does. The JSON says which tap: a card uses `rail.tap.cards[title.id]`, else
 * `rail.tap.card` (`detail`, `player`, `collection`, `link`, `none`); an atom its `action`. The client
 * carries out the ones it can: the detail page, the player (`/play/:type/:id`), or a link. The
 * delivery API has no stream address yet, so the player plays the title's `previewVideoUrl`.
 */
export function useTitleActions() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const launch = useAppSelector((s) => s.launch.launch);

  // Every type has a detail screen when the server sends `detailURL`; an older server names some.
  // `presentation` is what the tap says (`tap.card.presentation`): `dialog` opens the details over the
  // screen the viewer is on (that screen stays drawn behind, see `AppRoutes`); anything else is the page.
  // A tap inside a dialog replaces its title instead of stacking another, so one Close always returns.
  const detail = useCallback(
    (title: Title, presentation?: string | null) => {
      if (!hasDetailPage(launch, title.type)) {
        dispatch(showToast(`There is no detail page for ${title.type || 'this title'} yet.`));
        return;
      }
      const to = `/title/${encodeURIComponent(title.type ?? 'title')}/${title.id}`;
      const behind = (location.state as { background?: Location } | null)?.background;
      if (presentation === 'dialog') {
        navigate(to, { state: { background: behind ?? location }, replace: Boolean(behind) });
      } else {
        navigate(to);
      }
    },
    [navigate, dispatch, launch, location],
  );

  // The Share button: opens the menu (Facebook, WhatsApp, X, Copy link) with the title's own link.
  const share = useCallback(
    (title: Title) => {
      if (!shareLink(title)) {
        dispatch(showToast('Sharing is not available yet.'));
        return;
      }
      dispatch(openShare(title));
    },
    [dispatch],
  );

  const act = useCallback(
    (action: string, title: Title | null) => {
      if (!title) return;
      if (action === 'watchlist') {
        void dispatch(toggleWatchlist(title));
        return;
      }
      if (action === 'share') {
        void share(title);
        return;
      }
      if (action === 'play') {
        // The player, laid out by the product's player config; the title goes along for its name and picture.
        navigate(`/play/${title.type ?? 'title'}/${title.id}`, { state: { title } });
        return;
      }
      if (action === 'more_info' || action === 'detail') {
        detail(title);
        return;
      }
      dispatch(showToast(`"${action}" is not available yet.`));
    },
    [navigate, detail, dispatch, share],
  );

  const open = useCallback(
    (title: Title, rail?: Rail) => {
      const tap = rail ? (rail.tap.cards[title.id] ?? rail.tap.card) : null;
      switch (tap?.type ?? 'detail') {
        case 'none':
          return;
        case 'player':
          act('play', title);
          return;
        case 'link':
          if (tap?.target) window.open(tap.target, '_blank', 'noopener');
          return;
        case 'collection':
          dispatch(showToast('Opening a full list is not available yet.'));
          return;
        default:
          detail(title, tap?.presentation);
      }
    },
    [act, detail, dispatch],
  );

  /** A rail's "See all", as its `seeAll.tap` says: a link, nothing, a storefront (`page`, its address sent by the
   * server), or (the default) all of the rail's titles in a grid. */
  const seeAll = useCallback(
    (
      rail: Rail,
      block: Block | null,
      slug: string | null,
      background: Fill | null = null,
      design: SeeAllPageDesign | null = null,
    ) => {
      const tap = rail.seeAll.tap;
      if (tap?.type === 'none') return;
      if (tap?.type === 'link') {
        if (tap.target) window.open(tap.target, '_blank', 'noopener');
        return;
      }
      // A storefront the editor picked (Movies, Shows...): the server sends its address.
      const storefront = tap?.type === 'page' ? storefrontOf(tap.target) : null;
      if (storefront) {
        navigate(`/p/${encodeURIComponent(storefront)}`);
        return;
      }
      if (!slug) {
        dispatch(showToast('This list cannot be opened from here.'));
        return;
      }
      navigate(`/list/${encodeURIComponent(slug)}/${encodeURIComponent(rail.key)}`, {
        // `pageBackground`, not `background`: the router's `state.background` is the screen a details dialog
        // draws over (`App.tsx`), so a page fill under that name would replace the grid with that screen.
        state: { rail, block, pageBackground: background, design },
      });
    },
    [navigate, dispatch],
  );

  return { open, act, seeAll };
}
