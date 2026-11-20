import type { Block, Title } from '@/lib/api/types';
import { assetUrl } from '@/lib/api/endpoints';
import { imageSrc } from '@/lib/render/fields';

const warmed = new Set<string>();

/**
 * Asks the browser for the pop-up's picture of each title a rail shows, ahead of any hover, so the pop-up opens
 * with its picture already there (a request made on the hover would arrive after the pop-up has opened, and the
 * picture would pop in). The picture is the one the pop-up design asks for (`insetImage`, in its `imageAspect`).
 * A few at a time when the browser is idle, never twice for one address.
 */
export function warmPopupPictures(design: Block, titles: (Title | null)[], limit = 30): void {
  warmIcons(design);
  const inset = design.card.insetImage;
  if (!inset) return;
  const urls = titles
    .slice(0, limit)
    .map((t) => (t ? imageSrc(inset, t, design.card.imageAspect) : null))
    .filter((u): u is string => Boolean(u) && !warmed.has(u as string));
  let i = 0;
  const next = () => {
    for (let n = 0; n < 4 && i < urls.length; n++, i++) {
      const url = urls[i]!;
      warmed.add(url);
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
    if (i < urls.length) schedule();
  };
  const schedule = () => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
    if (ric) ric(next);
    else window.setTimeout(next, 120);
  };
  schedule();
}

/** The pop-up's button icons (Play, Share...): small files, asked for once with the first rail. */
function warmIcons(design: Block): void {
  const atoms = [...design.atoms, ...design.components.flatMap((c) => c.atoms)];
  for (const a of atoms) {
    for (const layer of a.style.layers) {
      const svg = layer.type === 'icon' ? layer.icon?.svg : null;
      if (!svg) continue;
      const url = assetUrl(svg);
      if (warmed.has(url)) continue;
      warmed.add(url);
      new Image().src = url;
    }
  }
}
