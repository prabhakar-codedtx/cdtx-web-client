import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  DETAIL_SCREEN,
  getDetailPage,
  getPage,
  getRailItems,
  getTabPage,
  setWatchlist,
} from '@/lib/api/endpoints';
import { showToast } from '@/app/uiSlice';
import { getDeliveryContext } from '@/lib/device/deviceContext';
import { ApiError } from '@/lib/api/client';
import { limiter, wait, worthRetrying } from '@/lib/api/queue';
import type { Page, Rail, Title } from '@/lib/api/types';
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
  /** The latest call for each rail's titles (its request id): an older answer that comes after it is dropped. */
  latest: Record<string, string>;
  /** Goes up each time the viewer's own progress is saved: a screen showing it asks again. */
  viewerVersion: number;
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
    const { launch, tabs } = (getState() as RootState).launch;
    if (!launch) return rejectWithValue({ error: 'Not started', code: null });
    // A tab from the tab bar opens through its own URL: the storefront it opens now.
    const tab = tabs.find((t) => t.slug === req.slug && t.tabId && t.url);
    const ctx = getDeliveryContext();
    try {
      if (req.slug === DETAIL_SCREEN && req.contentId) {
        const page = await getDetailPage(launch, req.contentId, req.type, ctx);
        if (!page)
          return rejectWithValue({ error: 'There is no detail page for this kind of title.', code: 404 });
        return { key: pageKey(req.slug, req.contentId, ctx.dt), page };
      }
      if (tab?.url && !req.contentId) {
        return { key: pageKey(req.slug, req.contentId, ctx.dt), page: await getTabPage(tab.url) };
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

/**
 * The rails whose titles are the viewer's own (`source.type`): My list and Continue Watching. They
 * change without a publish (a title added here, in another tab, on another device, or watched), so
 * they are asked for again each time they are shown, never taken from what was loaded before.
 */
const VIEWER_SOURCES = new Set(['my_list', 'continue_watching']);
export const isViewerRail = (rail: Pick<Rail, 'source'>): boolean =>
  VIEWER_SOURCES.has(rail.source.type ?? '');

/**
 * The rails' title calls go out a few at a time: twenty at once (a long Home screen scrolled fast)
 * went past the browser's connections per server and the backend's database, and most timed out.
 */
const railCalls = limiter(4);
/** How long a rail whose titles did not come waits before it asks once more. */
const RETRY_AFTER_MS = 2000;

/**
 * One rail's titles, in turn with the other rails. A call that got no answer, or the server's own
 * failure, is asked once more after a short wait (a moment's network drop must not lose the rail for
 * the whole visit); a second failure, or a 4xx, is final. The wait does not hold a place in the queue.
 */
async function fetchRailItems(contentUrl: string): Promise<Title[]> {
  try {
    return await railCalls(() => getRailItems(contentUrl));
  } catch (e) {
    if (!worthRetrying(e)) throw e;
    await wait(RETRY_AFTER_MS);
    return railCalls(() => getRailItems(contentUrl));
  }
}

/** A rail's titles, by the rail's own `source.contentUrl` (complete as the server sent it). */
export const loadItems = createAsyncThunk(
  'pages/items',
  async (contentUrl: string) => ({ contentUrl, items: await fetchRailItems(contentUrl) }),
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
    // What the pressed button showed ("Watchlist" or "In my list") is what is flipped: the copy it was
    // drawn from, not the first copy found, which can be an older one (another rail, loaded before
    // the list changed in another tab or on another device).
    const shown = title.badges ? Boolean(title.badges.inWatchlist) : isSaved(state, title.id);
    const saved = !shown;
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
  items: await fetchRailItems(contentUrl),
}));

const slice = createSlice({
  name: 'pages',
  initialState: { pages: {}, items: {}, latest: {}, viewerVersion: 0 } as PagesState,
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
    /**
     * The viewer's progress was saved: a screen on show asks for its page again (a rail's count may
     * have changed, e.g. 0 -> 1). Continue Watching's titles are not dropped: the rail asks for them
     * again each time it is shown, after the save (`progressSaved` in `endpoints.ts`), and keeps the
     * ones it has on screen until the new ones come (dropping them left the row empty).
     */
    viewerChanged(s) {
      s.viewerVersion += 1;
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
      s.latest[a.meta.arg] = a.meta.requestId;
      s.items[a.meta.arg] = { status: 'loading', data: null, error: null, code: null };
    });
    b.addCase(refreshItems.pending, (s, a) => {
      s.latest[a.meta.arg] = a.meta.requestId;
    });
    b.addCase(loadItems.fulfilled, (s, a) => {
      if (s.latest[a.meta.arg] !== a.meta.requestId) return;
      s.items[a.payload.contentUrl] = { status: 'ready', data: a.payload.items, error: null, code: null };
    });
    b.addCase(refreshItems.fulfilled, (s, a) => {
      // Add, then Remove at once: the list asked for after the Remove is the one kept.
      if (s.latest[a.meta.arg] !== a.meta.requestId) return;
      s.items[a.payload.contentUrl] = { status: 'ready', data: a.payload.items, error: null, code: null };
    });
    b.addCase(loadItems.rejected, (s, a) => {
      if (s.latest[a.meta.arg] !== a.meta.requestId) return;
      s.items[a.meta.arg] = { status: 'failed', data: null, error: a.error.message ?? 'Failed', code: null };
    });
    // A refresh that fails keeps the titles already shown.
  },
});

export const { viewerChanged } = slice.actions;
export default slice.reducer;
export type { PagesState, Entry };
