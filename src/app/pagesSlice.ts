import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { DETAIL_SCREEN, getDetailPage, getPage, getRailItems, setWatchlist } from '@/lib/api/endpoints';
import { showToast } from '@/app/uiSlice';
import { getDeliveryContext } from '@/lib/device/deviceContext';
import { ApiError } from '@/lib/api/client';
import type { Page, Title } from '@/lib/api/types';
import type { RootState } from '@/app/store';

export interface PageRequest {
  /** A tab's slug, or `DETAIL_SCREEN` for a title's detail screen (with `contentId`). */
  slug: string;
  contentId?: string;
  /** A detail screen: the title's type, for an older server that names a page per type. */
  type?: string;
}

/** One page is one request key: the screen, the title it is opened for, and the device it was asked as. */
export const pageKey = (slug: string, contentId: string | undefined, dt: string): string =>
  `${dt}|${slug}|${contentId ?? ''}`;

interface Entry<T> {
  status: 'loading' | 'ready' | 'failed';
  data: T | null;
  error: string | null;
  /** HTTP status of a failure, so a missing page reads differently from a broken server. */
  code: number | null;
}

interface PagesState {
  pages: Record<string, Entry<Page>>;
  items: Record<string, Entry<Title[]>>;
}

const failure = (e: unknown): { error: string; code: number | null } => ({
  error: e instanceof Error ? e.message : 'Failed',
  code: e instanceof ApiError ? (e.status ?? null) : null,
});

/** A screen. Asked again each time it is opened: a publish must reach the next visit. */
export const loadPage = createAsyncThunk<
  { key: string; page: Page },
  PageRequest,
  { rejectValue: { error: string; code: number | null } }
>(
  'pages/load',
  async (req, { getState, rejectWithValue }) => {
    const launch = (getState() as RootState).launch.launch;
    if (!launch) return rejectWithValue({ error: 'Not started', code: null });
    const ctx = getDeliveryContext();
    try {
      if (req.slug === DETAIL_SCREEN && req.contentId) {
        const page = await getDetailPage(launch, req.contentId, req.type, ctx);
        if (!page)
          return rejectWithValue({ error: 'There is no detail page for this kind of title.', code: 404 });
        return { key: pageKey(req.slug, req.contentId, ctx.dt), page };
      }
      return {
        key: pageKey(req.slug, req.contentId, ctx.dt),
        page: await getPage(launch, req.slug, ctx, { contentId: req.contentId }),
      };
    } catch (e) {
      return rejectWithValue(failure(e));
    }
  },
  {
    // A page already being fetched is not asked for twice.
    condition: (req, { getState }) => {
      const key = pageKey(req.slug, req.contentId, getDeliveryContext().dt);
      return (getState() as RootState).pages.pages[key]?.status !== 'loading';
    },
  },
);

/** A rail's titles, by the rail's own `source.contentUrl` (complete as the server sent it). */
export const loadItems = createAsyncThunk(
  'pages/items',
  async (contentUrl: string) => ({ contentUrl, items: await getRailItems(contentUrl) }),
  {
    condition: (url, { getState }) => {
      const e = (getState() as RootState).pages.items[url];
      return !e || e.status === 'failed';
    },
  },
);

/** Whether the viewer has the title in their list, as the titles already loaded say (the server flags them). */
function isSaved(state: PagesState, id: string): boolean {
  for (const entry of Object.values(state.items)) {
    const hit = entry.data?.find((t) => t.id === id);
    if (hit) return Boolean(hit.badges?.inWatchlist);
  }
  return false;
}

/**
 * The Add to watchlist button: add the title to the viewer's list, or take it out when it is there.
 * Every loaded copy of the title is flipped at once so the button changes as it is tapped; when the
 * call fails they are flipped back and a message says so. A "My list" rail is asked for again after.
 */
export const toggleWatchlist = createAsyncThunk<void, Title>(
  'pages/watchlist',
  async (title, { dispatch, getState }) => {
    const state = (getState() as RootState).pages;
    const saved = !isSaved(state, title.id);
    dispatch(slice.actions.savedChanged({ id: title.id, saved }));
    try {
      await setWatchlist(title.id, saved);
    } catch {
      dispatch(slice.actions.savedChanged({ id: title.id, saved: !saved }));
      dispatch(showToast(saved ? 'Could not add to your list.' : 'Could not remove from your list.'));
      return;
    }
    dispatch(showToast(saved ? 'Added to your list.' : 'Removed from your list.'));
    // A rail that lists the viewer's saved titles changed: fetch it again.
    const rails = Object.values((getState() as RootState).pages.pages).flatMap((e) => e.data?.rails ?? []);
    for (const r of rails) {
      if (r.source.type === 'my_list' && r.source.contentUrl)
        void dispatch(refreshItems(r.source.contentUrl));
    }
  },
);

/** A rail's titles again, kept on screen until the new ones come (unlike `loadItems`, which empties it). */
export const refreshItems = createAsyncThunk('pages/refreshItems', async (contentUrl: string) => ({
  contentUrl,
  items: await getRailItems(contentUrl),
}));

const slice = createSlice({
  name: 'pages',
  initialState: { pages: {}, items: {} } as PagesState,
  reducers: {
    /** Every loaded copy of a title says whether the viewer saved it (exactly one of the two flags). */
    savedChanged: (s, a: { payload: { id: string; saved: boolean } }) => {
      for (const entry of Object.values(s.items)) {
        for (const t of entry.data ?? []) {
          if (t.id === a.payload.id && t.badges) {
            t.badges.inWatchlist = a.payload.saved;
            t.badges.notInWatchlist = !a.payload.saved;
          }
        }
      }
    },
  },
  extraReducers: (b) => {
    b.addCase(loadPage.pending, (s, a) => {
      const key = pageKey(a.meta.arg.slug, a.meta.arg.contentId, getDeliveryContext().dt);
      const old = s.pages[key];
      // Keep showing the page already there while the new copy comes.
      s.pages[key] = { status: 'loading', data: old?.data ?? null, error: null, code: null };
    });
    b.addCase(loadPage.fulfilled, (s, a) => {
      s.pages[a.payload.key] = { status: 'ready', data: a.payload.page, error: null, code: null };
    });
    b.addCase(loadPage.rejected, (s, a) => {
      const key = pageKey(a.meta.arg.slug, a.meta.arg.contentId, getDeliveryContext().dt);
      const f = a.payload ?? failure(a.error);
      s.pages[key] = { status: 'failed', data: s.pages[key]?.data ?? null, error: f.error, code: f.code };
    });
    b.addCase(loadItems.pending, (s, a) => {
      s.items[a.meta.arg] = { status: 'loading', data: null, error: null, code: null };
    });
    b.addCase(loadItems.fulfilled, (s, a) => {
      s.items[a.payload.contentUrl] = { status: 'ready', data: a.payload.items, error: null, code: null };
    });
    b.addCase(refreshItems.fulfilled, (s, a) => {
      s.items[a.payload.contentUrl] = { status: 'ready', data: a.payload.items, error: null, code: null };
    });
    b.addCase(loadItems.rejected, (s, a) => {
      s.items[a.meta.arg] = { status: 'failed', data: null, error: a.error.message ?? 'Failed', code: null };
    });
  },
});

export default slice.reducer;
export type { PagesState, Entry };
