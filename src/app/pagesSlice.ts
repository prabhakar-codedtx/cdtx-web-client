import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getPage, getRailItems } from '@/lib/api/endpoints';
import { getDeliveryContext } from '@/lib/device/deviceContext';
import { ApiError } from '@/lib/api/client';
import type { Page, Title } from '@/lib/api/types';
import type { RootState } from '@/app/store';

export interface PageRequest {
  slug: string;
  contentId?: string;
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
  initialState: { pages: {}, items: {} } as PagesState,
  reducers: {},
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

export default slice.reducer;
export type { PagesState, Entry };
