import { useEffect, useState } from 'react';
import { getDt, MOBILE_MAX_PX } from '@/lib/device/deviceContext';

/** The device the client asks as; changes only when the window crosses into or out of a phone's width. */
export function useDt(): string {
  const [dt, setDt] = useState(() => getDt());
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_PX}px)`);
    const on = () => setDt(getDt());
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dt;
}
