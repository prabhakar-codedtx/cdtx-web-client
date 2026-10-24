import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getDesignSystem, getLaunch, getTabs, type Launch } from '@/lib/api/endpoints';
import { getDeliveryContext } from '@/lib/device/deviceContext';
import type { NavPage, Theme } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

interface LaunchState {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  error: string | null;
  launch: Launch | null;
  /** The Design System: the fonts to load and the default font. */
  theme: Theme | null;
  tabs: NavPage[];
  /** The device the launch config and tabs were asked for; another device asks again. */
  dt: string | null;
}

const initial: LaunchState = { status: 'idle', error: null, launch: null, theme: null, tabs: [], dt: null };

/** Start: the launch config (the one address the client knows), the Design System, then the tabs. */
export const boot = createAsyncThunk('launch/boot', async (_: void, { getState }) => {
  const ctx = getDeliveryContext();
  const state = (getState() as { launch: LaunchState }).launch;
  const launch = state.launch && state.dt === ctx.dt ? state.launch : await getLaunch(ctx);
  const [theme, tabs] = await Promise.all([
    // A Design System that cannot be read leaves the page drawn without its fonts, not blank.
    getDesignSystem(launch, ctx).catch(() => null),
    getTabs(launch, ctx),
  ]);
  return { launch, theme, tabs, dt: ctx.dt };
});

const slice = createSlice({
  name: 'launch',
  initialState: initial,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(boot.pending, (s) => {
      s.status = s.launch ? s.status : 'loading';
      s.error = null;
    });
    b.addCase(boot.fulfilled, (s, a) => {
      s.status = 'ready';
      s.launch = a.payload.launch;
      s.theme = a.payload.theme;
      s.tabs = a.payload.tabs;
      s.dt = a.payload.dt;
    });
    b.addCase(boot.rejected, (s, a) => {
      s.status = 'failed';
      s.error = a.error.message ?? 'Could not start';
    });
  },
});

export default slice.reducer;
export type { LaunchState };
export const isApiNotFound = (e: unknown): boolean => e instanceof ApiError && e.status === 404;
