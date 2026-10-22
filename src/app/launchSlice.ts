import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getLaunch, getTabs, type Launch } from '@/lib/api/endpoints';
import { getDeliveryContext } from '@/lib/device/deviceContext';
import type { TabSummary } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';

interface LaunchState {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  error: string | null;
  launch: Launch | null;
  tabs: TabSummary[];
  /** The device the tabs were asked for; a window that crosses into or out of a phone's width asks again. */
  dt: string | null;
}

const initial: LaunchState = { status: 'idle', error: null, launch: null, tabs: [], dt: null };

/** Start: the launch config (the one address the client knows), then the tabs it points at. */
export const boot = createAsyncThunk('launch/boot', async (_: void, { getState }) => {
  const ctx = getDeliveryContext();
  const known = (getState() as { launch: LaunchState }).launch.launch;
  const launch = known ?? (await getLaunch(ctx));
  const tabs = await getTabs(launch, ctx);
  return { launch, tabs, dt: ctx.dt };
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
