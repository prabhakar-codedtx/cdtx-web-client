import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Title } from '@/lib/api/types';

/** A short message at the bottom of the screen (an action the client cannot carry out yet). */
const slice = createSlice({
  name: 'ui',
  initialState: {
    toast: null as { id: number; text: string } | null,
    /** The title whose Share menu is open (Facebook, WhatsApp, X, Copy link). */
    share: null as Title | null,
  },
  reducers: {
    showToast: (s, a: PayloadAction<string>) => {
      s.toast = { id: Date.now(), text: a.payload };
    },
    clearToast: (s) => {
      s.toast = null;
    },
    openShare: (s, a: PayloadAction<Title>) => {
      s.share = a.payload;
    },
    closeShare: (s) => {
      s.share = null;
    },
  },
});

export const { showToast, clearToast, openShare, closeShare } = slice.actions;
export default slice.reducer;
