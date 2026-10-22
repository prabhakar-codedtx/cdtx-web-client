import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** A short message at the bottom of the screen (an action the client cannot carry out yet). */
const slice = createSlice({
  name: 'ui',
  initialState: { toast: null as { id: number; text: string } | null },
  reducers: {
    showToast: (s, a: PayloadAction<string>) => {
      s.toast = { id: Date.now(), text: a.payload };
    },
    clearToast: (s) => {
      s.toast = null;
    },
  },
});

export const { showToast, clearToast } = slice.actions;
export default slice.reducer;
