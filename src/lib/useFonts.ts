import { useEffect } from 'react';
import type { DeliveryPage } from '@/lib/api/types';

/** Loads the fonts the page names (`typography.fonts[].cssUrl`), once each. */
export function useFonts(page: DeliveryPage | null): void {
  useEffect(() => {
    for (const f of page?.typography.fonts ?? []) {
      if (!f.cssUrl || document.querySelector(`link[data-font="${CSS.escape(f.cssUrl)}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = f.cssUrl;
      link.dataset.font = f.cssUrl;
      document.head.appendChild(link);
    }
  }, [page]);
}
