import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { DETAIL_SCREEN, getDetailPage, getPage, getRailItems } from '@/lib/api/endpoints';
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
  /** Goes up each time the viewer's own progress is saved: a screen showing it asks again. */
  viewerVersion: number;
}

/** Rail sources whose titles are the viewer's own (they change as the viewer watches). */
export const VIEWER_SOURCES: ReadonlySet<string> = new Set(['continue_watching']);

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

const slice = createSlice({
  name: 'pages',
  initialState: { pages: {}, items: {}, viewerVersion: 0 } as PagesState,
  reducers: {
    /**
     * The viewer's progress was saved: the titles of the viewer's own rails (Continue Watching)
     * are dropped, so they are asked for again when shown, and the pages are asked for again
     * (a rail's count may have changed, e.g. 0 -> 1). Every other rail keeps its titles.
     */
    viewerChanged(s) {
      s.viewerVersion += 1;
      for (const entry of Object.values(s.pages)) {
        for (const rail of entry.data?.rails ?? []) {
          const url = rail.source?.contentUrl;
          if (url && rail.source.type && VIEWER_SOURCES.has(rail.source.type)) delete s.items[url];
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
    b.addCase(loadItems.rejected, (s, a) => {
      s.items[a.meta.arg] = { status: 'failed', data: null, error: a.error.message ?? 'Failed', code: null };
    });
  },
});

export const { viewerChanged } = slice.actions;
export default slice.reducer;
export type { PagesState, Entry };
