import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { getNav, getTab } from '@/lib/api/endpoints';
import { getDeliveryContext } from '@/lib/device/deviceContext';
import type { DeliveryContainer, DeliveryContext, DeliveryStorefront, DeliveryTab } from '@/lib/api/types';
import { createLogger } from '@/lib/logger/logger';

const log = createLogger('home');

interface HomeState {
  ctx: DeliveryContext | null;
  storefront: DeliveryStorefront | null;
  activeTab: DeliveryTab | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: HomeState = {
  ctx: null,
  storefront: null,
  activeTab: null,
  status: 'idle',
  error: null,
};

/** Nav, then that tab's rails — the two calls every screen load needs before
 * a single card can render. `preferredSlug` lets the top nav switch tabs
 * without re-fetching nav, since the storefront/tab list never changes
 * mid-session. */
export const loadHome = createAsyncThunk('home/load', async (preferredSlug: string | undefined) => {
  const ctx = getDeliveryContext();
  const storefront = await getNav(ctx);
  const tab = storefront.tabs.find((t) => t.slug === (preferredSlug ?? 'home')) ?? storefront.tabs[0];
  if (!tab) throw new Error('Storefront has no tabs');
  const activeTab = await getTab(storefront.id, tab.id, ctx);
  log.info(`loaded "${activeTab.name}" — ${activeTab.containers.length} rails`);
  return { ctx, storefront, activeTab };
});

export const switchTab = createAsyncThunk('home/switchTab', async (tabId: string, { getState }) => {
  const state = getState() as { home: HomeState };
  const { ctx, storefront } = state.home;
  if (!ctx || !storefront) throw new Error('Cannot switch tab before initial load');
  const activeTab = await getTab(storefront.id, tabId, ctx);
  return activeTab;
});

const homeSlice = createSlice({
  name: 'home',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadHome.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loadHome.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.ctx = action.payload.ctx;
        state.storefront = action.payload.storefront;
        state.activeTab = action.payload.activeTab;
      })
      .addCase(loadHome.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'Failed to load storefront';
      })
      .addCase(switchTab.fulfilled, (state, action: PayloadAction<DeliveryTab>) => {
        state.activeTab = action.payload;
      });
  },
});

export default homeSlice.reducer;

// A stable reference for "no tab loaded yet" — returning a fresh `[]` here
// on every call is what a naive `?? []` would do, and it makes the selector
// look like it changed on every render even when nothing did.
const NO_CONTAINERS: DeliveryContainer[] = [];

export const selectContainers = (state: { home: HomeState }): DeliveryContainer[] =>
  state.home.activeTab?.containers ?? NO_CONTAINERS;
