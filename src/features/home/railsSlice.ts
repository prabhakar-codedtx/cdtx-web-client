import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getRailItems } from '@/lib/api/endpoints';
import type { DeliveryItem } from '@/lib/api/types';

interface RailState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  items: DeliveryItem[];
  error: string | null;
}

type RailsState = Record<string, RailState>;

const initialState: RailsState = {};

/** Fills one rail. Keyed by container id, not source id — a container is the
 * unit the UI renders, and it only ever shows its top-priority source (see
 * services/delivery.py: sources are already priority-sorted; the app takes
 * sources[0], never merges multiple sources into one row). */
export const fetchRailItems = createAsyncThunk(
  'rails/fetch',
  async ({ containerId, contentUrl }: { containerId: string; contentUrl: string }) => {
    const items = await getRailItems(contentUrl);
    return { containerId, items };
  },
);

const railsSlice = createSlice({
  name: 'rails',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRailItems.pending, (state, action) => {
        state[action.meta.arg.containerId] = { status: 'loading', items: [], error: null };
      })
      .addCase(fetchRailItems.fulfilled, (state, action) => {
        state[action.payload.containerId] = {
          status: 'succeeded',
          items: action.payload.items,
          error: null,
        };
      })
      .addCase(fetchRailItems.rejected, (state, action) => {
        state[action.meta.arg.containerId] = {
          status: 'failed',
          items: [],
          error: action.error.message ?? 'Failed to load row',
        };
      });
  },
});

export default railsSlice.reducer;

export const selectRail = (containerId: string) => (state: { rails: RailsState }) => state.rails[containerId];
