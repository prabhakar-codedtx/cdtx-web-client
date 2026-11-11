import { useEffect, useState } from 'react';
import { getDt, MOBILE_MAX_PX } from '@/lib/device/deviceContext';

/**
 * How long the width must stay across the phone line before the client asks as the other device. A
 * window dragged back and forth over it, or one still settling its size as it opens, would otherwise
 * ask for the launch config, the tabs and the page again on every crossing.
 */
const SETTLE_MS = 250;

/** The device the client asks as; changes only when the window crosses into or out of a phone's width. */
export function useDt(): string {
  const [dt, setDt] = useState(() => getDt());
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_PX}px)`);
    let timer: number | undefined;
    const on = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setDt(getDt()), SETTLE_MS);
    };
    mq.addEventListener('change', on);
    return () => {
      mq.removeEventListener('change', on);
      window.clearTimeout(timer);
    };
  }, []);
  return dt;
}
