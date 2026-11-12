import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getDesignSystem, getLaunch, getTabs, type Launch } from '@/lib/api/endpoints';
import { getDeliveryContext } from '@/lib/device/deviceContext';
import type { NavBarStyle, NavPage, Theme } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

interface LaunchState {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  error: string | null;
  launch: Launch | null;
  /** The Design System: the fonts to load and the default font. */
  theme: Theme | null;
  tabs: NavPage[];
  /** How the tab bar looks on this device; null: the client's own look (an older server). */
  navStyle: NavBarStyle | null;
  /** The device the launch config and tabs were asked for; another device asks again. */
  dt: string | null;
  /**
   * The latest start asked for (its request id). Two can overlap (the window crossed the phone line while
   * the first was on its way): only the latest one's answer is kept, whichever comes back last.
   */
  latest: string | null;
}

const initial: LaunchState = {
  status: 'idle',
  error: null,
  launch: null,
  theme: null,
  tabs: [],
  navStyle: null,
  dt: null,
  latest: null,
};

/** Start: the launch config (the one address the client knows), the Design System, then the tabs. */
export const boot = createAsyncThunk('launch/boot', async (_: void, { getState }) => {
  const ctx = getDeliveryContext();
  const state = (getState() as { launch: LaunchState }).launch;
  const launch = state.launch && state.dt === ctx.dt ? state.launch : await getLaunch(ctx);
  const [theme, bar] = await Promise.all([
    // A Design System that cannot be read leaves the page drawn without its fonts, not blank.
    getDesignSystem(launch, ctx).catch(() => null),
    getTabs(launch, ctx),
  ]);
  return { launch, theme, tabs: bar.tabs, navStyle: bar.style, dt: ctx.dt };
});

const slice = createSlice({
  name: 'launch',
  initialState: initial,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(boot.pending, (s, a) => {
      s.latest = a.meta.requestId;
      s.status = s.launch ? s.status : 'loading';
      s.error = null;
    });
    b.addCase(boot.fulfilled, (s, a) => {
      if (s.latest !== a.meta.requestId) return;
      s.status = 'ready';
      s.launch = a.payload.launch;
      s.theme = a.payload.theme;
      s.tabs = a.payload.tabs;
      s.navStyle = a.payload.navStyle;
      s.dt = a.payload.dt;
    });
    b.addCase(boot.rejected, (s, a) => {
      if (s.latest !== a.meta.requestId) return;
      s.status = 'failed';
      s.error = a.error.message ?? 'Could not start';
    });
  },
});

export default slice.reducer;
export type { LaunchState };
export const isApiNotFound = (e: unknown): boolean => e instanceof ApiError && e.status === 404;
