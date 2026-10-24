import { LOCALE, REGION } from '@/lib/config';
import type { DeliveryContext } from '@/lib/api/types';

/** Below this width the browser is a phone: it asks for the mobile designs. */
export const MOBILE_MAX_PX = 767;

function isAndroidTv(userAgent: string): boolean {
  return /Android/.test(userAgent) && /(AFT[A-Z]|GoogleTV|Android TV)/.test(userAgent);
}

/**
 * Which device the client says it is (`dt`), so the server sends the card designs and sizes made for
 * it. `VITE_DT` fixes it; otherwise a TV browser asks as a TV, a narrow window as mobile web, and
 * anything else as web.
 */
export function getDt(width: number = window.innerWidth): string {
  if (import.meta.env.VITE_DT) return import.meta.env.VITE_DT;
  if (isAndroidTv(navigator.userAgent)) return 'androidtv';
  return width <= MOBILE_MAX_PX ? 'mobileweb' : 'web';
}

export function getDeliveryContext(width?: number): DeliveryContext {
  return { reg: REGION, locale: LOCALE, dt: getDt(width) };
}
