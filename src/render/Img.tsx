import { useCallback, useState, type ImgHTMLAttributes } from 'react';

/**
 * How soon a picture is fetched:
 * - `lazy` (the default): only once it nears the screen (a card further along a row, or further down the page);
 * - `eager`: at once, as it is drawn (a card on screen when the page opens);
 * - `high`: at once, ahead of the others (the hero: what the viewer sees first).
 */
export type ImgPriority = 'lazy' | 'eager' | 'high';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'loading' | 'src'> & {
  src: string;
  priority?: ImgPriority;
};

const lessMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * A picture that loads as `priority` says, is decoded off the main thread, and fades in once it has
 * arrived, over whatever is behind it (the card's `fallbackColor`), instead of painting in strips. A
 * picture that fails to load stays hidden rather than showing the browser's broken-image mark.
 */
export function Img({ src, priority = 'lazy', style, onLoad, alt = '', ...rest }: Props) {
  // The address that has arrived: a new `src` (another title in the same card) fades in again.
  const [arrived, setArrived] = useState<string | null>(null);
  // A picture already in the browser's cache can finish before React listens for `load`.
  const ref = useCallback(
    (el: HTMLImageElement | null) => {
      if (el?.complete && el.naturalWidth > 0) setArrived(src);
    },
    [src],
  );
  const shown = arrived === src;
  const opacity = style?.opacity ?? 1;
  return (
    <img
      ref={ref}
      // `loading` before `src`: a browser that reads them in order must know the picture is lazy first.
      loading={priority === 'lazy' ? 'lazy' : 'eager'}
      decoding="async"
      // React 18 does not know `fetchPriority`; the lowercase attribute reaches the DOM as is.
      {...(priority === 'high' ? ({ fetchpriority: 'high' } as object) : {})}
      src={src}
      alt={alt}
      draggable={false}
      onLoad={(e) => {
        setArrived(src);
        onLoad?.(e);
      }}
      style={{
        ...style,
        opacity: shown ? opacity : 0,
        transition: lessMotion() ? undefined : 'opacity 200ms ease-out',
      }}
      {...rest}
    />
  );
}
