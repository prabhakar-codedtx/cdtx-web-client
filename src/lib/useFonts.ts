import { useEffect } from 'react';
import type { Theme } from '@/lib/api/types';

/** Loads the Design System's fonts (`fonts[].cssUrl`), once each. */
export function useFonts(theme: Theme | null): void {
  useEffect(() => {
    for (const f of theme?.fonts ?? []) {
      if (!f.cssUrl || document.querySelector(`link[data-font="${CSS.escape(f.cssUrl)}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = f.cssUrl;
      link.dataset.font = f.cssUrl;
      document.head.appendChild(link);
    }
  }, [theme]);
}
