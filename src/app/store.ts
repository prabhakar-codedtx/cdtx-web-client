import { configureStore } from '@reduxjs/toolkit';
import homeReducer from '@/features/home/homeSlice';
import railsReducer from '@/features/home/railsSlice';

export const store = configureStore({
  reducer: {
    home: homeReducer,
    rails: railsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
