import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/app/hooks';
import { showToast } from '@/app/uiSlice';
import { DETAIL_PAGES } from '@/lib/config';
import type { Block, Rail, Title } from '@/lib/api/types';

/**
 * What a tap does. The JSON says which tap: a card uses `rail.tap.cards[title.id]`, else
 * `rail.tap.card` (`detail`, `player`, `collection`, `link`, `none`); an atom its `action`. The client
 * carries out the ones it can: the detail page, the player (`/play/:type/:id`), or a link. The
 * delivery API has no stream address yet, so the player plays the title's `previewVideoUrl`.
 */
export function useTitleActions() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const detail = useCallback(
    (title: Title) => {
      const type = title.type ?? '';
      if (!DETAIL_PAGES[type]) {
        dispatch(showToast(`There is no detail page for ${type || 'this title'} yet.`));
        return;
      }
      navigate(`/title/${type}/${title.id}`);
    },
    [navigate, dispatch],
  );

  const act = useCallback(
    (action: string, title: Title | null) => {
      if (!title) return;
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
    [navigate, detail, dispatch],
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
          detail(title);
      }
    },
    [act, detail, dispatch],
  );

  /** A rail's "See all", as its `seeAll.tap` says: a link, nothing, or (the default) all of the rail's titles in a grid. */
  const seeAll = useCallback(
    (rail: Rail, block: Block | null, slug: string | null) => {
      const tap = rail.seeAll.tap;
      if (tap?.type === 'none') return;
      if (tap?.type === 'link') {
        if (tap.target) window.open(tap.target, '_blank', 'noopener');
        return;
      }
      if (!slug) {
        dispatch(showToast('This list cannot be opened from here.'));
        return;
      }
      navigate(`/list/${encodeURIComponent(slug)}/${encodeURIComponent(rail.key)}`, {
        state: { rail, block },
      });
    },
    [navigate, dispatch],
  );

  return { open, act, seeAll };
}
