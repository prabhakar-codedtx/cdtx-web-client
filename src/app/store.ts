import { configureStore } from '@reduxjs/toolkit';
import launchReducer from '@/app/launchSlice';
import pagesReducer from '@/app/pagesSlice';
import uiReducer from '@/app/uiSlice';

export const store = configureStore({
  reducer: { launch: launchReducer, pages: pagesReducer, ui: uiReducer },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
