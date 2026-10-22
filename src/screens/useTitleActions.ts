import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/app/hooks';
import { showToast } from '@/app/uiSlice';
import { DETAIL_PAGES } from '@/lib/config';
import type { PageRail, TitleItem } from '@/lib/api/types';

/**
 * What a tap does. The JSON says which tap (`tap.card.type` on the rail, `action` on a part); the
 * client carries out the ones it can: opening a title's detail page. Playback is not part of the
 * delivery API (no stream address), so Play opens the title and the rest say so.
 */
export function useTitleActions() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { pathname } = useLocation();

  const open = useCallback(
    (item: TitleItem, rail?: PageRail) => {
      if (rail?.tap.card?.type === 'none') return;
      if (!DETAIL_PAGES[item.content_type]) {
        dispatch(showToast(`There is no detail page for ${item.content_type} yet.`));
        return;
      }
      navigate(`/title/${item.content_type}/${item.id}`);
    },
    [navigate, dispatch],
  );

  const act = useCallback(
    (action: string, item: TitleItem | null) => {
      if (!item) return;
      if (action === 'play') {
        // On the title's own page there is nothing more to open.
        if (pathname.endsWith(`/${item.id}`))
          dispatch(showToast('Playback is not connected to this client yet.'));
        else open(item);
        return;
      }
      dispatch(showToast(`"${action}" is not available yet.`));
    },
    [pathname, open, dispatch],
  );

  return { open, act };
}
