import { Provider } from 'react-redux';
import { ThemeProvider } from 'styled-components';
import { store } from '@/app/store';
import { theme } from '@/theme/theme';
import { GlobalStyle } from '@/theme/GlobalStyle';
import { HomeScreen } from '@/features/home/HomeScreen';

export function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <HomeScreen />
      </ThemeProvider>
    </Provider>
  );
}
