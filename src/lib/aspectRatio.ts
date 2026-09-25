import type { DeliveryImage } from '@/lib/api/types';

/** Container/card aspect-ratio strings ("0-16x9", "0-2x3", ...) -> a CSS
 * `aspect-ratio` value. Unrecognized strings fall back to 16/9 rather than
 * throwing — a card is still worth rendering with a slightly-off shape. */
const CSS_RATIO: Record<string, string> = {
  '0-16x9': '16 / 9',
  '0-2x3': '2 / 3',
  '0-1x1': '1 / 1',
  '3-1x1': '3 / 1',
};

export function toCssAspectRatio(aspectRatio: string): string {
  return CSS_RATIO[aspectRatio] ?? '16 / 9';
}

/** `editorial art wins over catalog art` is the confirmed-contract's render
 * rule (see docs/delivery-api-contract-confirmed.md); the actual flat item
 * shape has no separate editorial layer, so this is just "closest aspect
 * match, else first image, else nothing" — good enough until that layer
 * exists on the wire. */
export function pickImage(images: DeliveryImage[], containerAspectRatio: string): string | undefined {
  return (images.find((img) => img.aspect_ratio === containerAspectRatio) ?? images[0])?.url;
}
