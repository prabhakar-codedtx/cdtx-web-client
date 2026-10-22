import type { DeliveryPage } from '@/lib/api/types';
import { backgroundCss } from '@/lib/render/background';
import { useFonts } from '@/lib/useFonts';
import { HeroBanner } from '@/screens/HeroBanner';
import { Rail } from '@/screens/Rail';
import { useTitleActions } from '@/screens/useTitleActions';

/**
 * One screen from its page JSON: the hero first, then the rails in order, spaced and padded as
 * `spacing` says, on the page's own background and in its own fonts.
 */
export function PageScreen({ page }: { page: DeliveryPage }) {
  useFonts(page);
  const { open, act } = useTitleActions();
  const sp = page.spacing;
  const pad = sp.railPaddingPx;
  return (
    <main
      style={{
        backgroundColor: page.background ?? undefined,
        ...backgroundCss(page.page_background),
        fontFamily: page.typography.default,
      }}
    >
      {page.hero && <HeroBanner rail={page.hero} onOpen={open} onAction={act} />}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: sp.railGapPx,
          paddingTop: sp.railPaddingTopPx ?? pad,
          paddingRight: sp.railPaddingRightPx ?? pad,
          paddingBottom: sp.railPaddingBottomPx ?? pad,
          paddingLeft: sp.railPaddingLeftPx ?? pad,
        }}
      >
        {page.rails.map((rail) => (
          <Rail key={rail.key} rail={rail} onOpen={open} onAction={act} />
        ))}
      </div>
    </main>
  );
}
