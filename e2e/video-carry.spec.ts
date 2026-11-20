import { expect, test, type Page } from '@playwright/test';

/**
 * The hero's preview video, carried from screen to screen (`src/player/carry.ts`): Home hero → the
 * title's page → the player. The same video goes on playing; only the picture, shade and metadata
 * around it change. Runs against a local CMS whose Home hero card plays previews on Web (Player:
 * Replaces the picture), opens the title's page when its video is tapped, and whose first hero title
 * has a preview cut from the title ("Preview starts at") and a trailer.
 */

const HERO = '[aria-roledescription="carousel"]';

/** A caption over the page, so the recorded video says what each step shows. */
async function say(page: Page, text: string) {
  await page.evaluate((t) => {
    let el = document.getElementById('e2e-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'e2e-caption';
      Object.assign(el.style, {
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '2147483647',
        padding: '8px 16px',
        borderRadius: '8px',
        background: 'rgba(255, 196, 0, 0.95)',
        color: '#111',
        font: '600 16px/1.3 system-ui, sans-serif',
        pointerEvents: 'none',
        maxWidth: '90vw',
        textAlign: 'center',
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}

/** Waits for the hero's video to play past `seconds` (early: every local test video is a 10 s clip), marks it (to know it again on the next screen),
 * and returns its second. */
async function heroVideoPlaying(page: Page, seconds = 2): Promise<number> {
  const video = page.locator(`${HERO} video`).first();
  await expect(video).toBeAttached({ timeout: 30_000 });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => (v.paused ? 0 : v.currentTime)), { timeout: 30_000 })
    .toBeGreaterThan(seconds);
  return video.evaluate((v: HTMLVideoElement) => {
    v.dataset.e2e = 'carried';
    return v.currentTime;
  });
}

/** The marked video: where it is, its second, whether it plays. Null once it is gone. */
function carried(page: Page) {
  return page.evaluate(() => {
    const v = document.querySelector<HTMLVideoElement>('video[data-e2e="carried"]');
    if (!v) return null;
    return {
      time: v.currentTime,
      paused: v.paused,
      inHero: Boolean(v.closest('[aria-roledescription="carousel"]')),
      shown: v.style.opacity !== '0',
    };
  });
}

/** The player's own `<video>` (not the carried one). */
function playerVideo(page: Page) {
  return page.locator('main video:not([data-e2e="carried"])').first();
}

/** Taps the playing hero video itself (not a button). */
async function tapHeroVideo(page: Page) {
  await page.evaluate(() => {
    const v = document.querySelector<HTMLVideoElement>('video[data-e2e="carried"]');
    v?.parentElement?.click();
  });
}

/** A button on the hero by its action (`play`, `trailer`...), as the card draws it. */
function heroButton(page: Page, action: string) {
  return page.locator(`${HERO} button[aria-label="${action}"], ${HERO} [role="button"][aria-label="${action}"]`).first();
}

test.describe('the hero video carries on from screen to screen', () => {
  test('Home hero: the picture first, then the video, and the metadata makes room', async ({ page }) => {
    await page.goto('/');
    await say(page, 'Home hero: the picture shows first');
    await expect(page.locator(HERO)).toBeVisible();
    await heroVideoPlaying(page);
    await say(page, 'The video fades in over the picture; Hero Metadata shrinks while it plays');
    // "While playing: Shrinks" on Hero Metadata (set in the CMS).
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('[data-item-id]')].some((e) => e.style.transform.includes('scale(0.75)')),
        ),
      )
      .toBe(true);
    await page.waitForTimeout(1500);
  });

  test('tapping the hero video opens the title page and the same video plays on', async ({ page }) => {
    await page.goto('/');
    const before = await heroVideoPlaying(page);
    await say(page, `Tap the playing video at ${before.toFixed(1)} s`);
    await tapHeroVideo(page);
    await expect(page).toHaveURL(/\/title\//);
    await say(page, 'Title page: the same video goes on, only the metadata changed');
    // The very same element, in the title page's hero, still playing, never started over.
    await expect.poll(async () => (await carried(page))?.inHero ?? false).toBe(true);
    const there = await carried(page);
    expect(there?.paused).toBe(false);
    expect(there!.time).toBeGreaterThanOrEqual(before);
    await page.waitForTimeout(1500);
    const later = await carried(page);
    expect(later!.time).toBeGreaterThan(there!.time);
  });

  test('Play on the title page carries the video into the player at the matching second', async ({ page }) => {
    await page.goto('/');
    await heroVideoPlaying(page);
    await tapHeroVideo(page);
    await expect(page).toHaveURL(/\/title\//);
    await expect.poll(async () => (await carried(page))?.inHero ?? false).toBe(true);
    const atTap = (await carried(page))!.time;
    await say(page, `Title page: press Play at ${atTap.toFixed(1)} s`);
    await heroButton(page, 'play').click();
    await expect(page).toHaveURL(/\/play\//);
    await say(page, 'Player: the video carries on, then the title stream takes over at the same point');
    const handoff = await page.evaluate(() => (history.state?.usr?.handoff ?? null) as { at: number | null } | null);
    expect(handoff?.at).not.toBeNull();
    // "Preview starts at" + the second of the tap (± the moment the click took).
    expect(handoff!.at!).toBeGreaterThan(atTap);
    // The player's own stream plays from that point on, and the carried video has gone.
    await expect
      // Its second, playing or not: every local test video is a 10 s clip, so a late takeover may find the
      // matching second at the clip's end.
      .poll(() => playerVideo(page).evaluate((v: HTMLVideoElement) => v.currentTime))
      .toBeGreaterThanOrEqual(Math.min(handoff!.at! - 0.5, 9.5));
    await expect.poll(() => carried(page)).toBeNull();
    await page.waitForTimeout(1500);
  });

  test('Watch Now on the Home hero carries the video into the player', async ({ page }) => {
    await page.goto('/');
    const atTap = await heroVideoPlaying(page);
    await say(page, `Home hero: press Watch Now at ${atTap.toFixed(1)} s`);
    // Watch Now is the hero's Play button.
    await heroButton(page, 'play').click();
    await expect(page).toHaveURL(/\/play\//);
    const handoff = await page.evaluate(() => (history.state?.usr?.handoff ?? null) as { at: number | null } | null);
    expect(handoff?.at).toBeGreaterThan(atTap);
    await say(page, `Player: carries on at ${handoff!.at!.toFixed(1)} s in the title`);
    await expect
      // Its second, playing or not: every local test video is a 10 s clip, so a late takeover may find the
      // matching second at the clip's end.
      .poll(() => playerVideo(page).evaluate((v: HTMLVideoElement) => v.currentTime))
      .toBeGreaterThanOrEqual(Math.min(handoff!.at! - 0.5, 9.5));
    await page.waitForTimeout(1500);
  });

  test('Trailer on the title page plays the title trailer in the player', async ({ page }) => {
    await page.goto('/');
    await heroVideoPlaying(page);
    await tapHeroVideo(page);
    await expect(page).toHaveURL(/\/title\//);
    await expect.poll(async () => (await carried(page))?.inHero ?? false).toBe(true);
    await say(page, 'Title page: press Trailer');
    await heroButton(page, 'trailer').click();
    await expect(page).toHaveURL(/\/play\//);
    const handoff = await page.evaluate(
      () => (history.state?.usr?.handoff ?? null) as { at: number | null; src?: string; muted: boolean } | null,
    );
    // The card played the preview, not the trailer: the trailer starts from its beginning, with the sound
    // the CMS's "Player sound" says (keep the card's, or on); the pre-roll as its "Ad before the player" says.
    expect(handoff?.src).toBeTruthy();
    expect(handoff?.at).toBeNull();
    expect(typeof handoff?.muted).toBe('boolean');
    await say(page, 'Player: the trailer from the start');
    await expect
      .poll(() => playerVideo(page).evaluate((v: HTMLVideoElement) => (v.paused ? '' : v.currentSrc)))
      .toBe(handoff!.src);
    await page.waitForTimeout(2000);
  });

  test('walkthrough: Home → title page → player, one video all the way', async ({ page }) => {
    await page.goto('/');
    await say(page, '1. Home hero: the picture first');
    await page.waitForTimeout(1500);
    await heroVideoPlaying(page, 0.3);
    await say(page, '2. After the delay the preview plays; the metadata shrinks');
    await page.waitForTimeout(1200);
    const start = (await carried(page))!.time;
    await say(page, `3. Tap the video (${start.toFixed(1)} s) → the title page opens`);
    await tapHeroVideo(page);
    await expect(page).toHaveURL(/\/title\//);
    await expect.poll(async () => (await carried(page))?.inHero ?? false).toBe(true);
    await say(page, '4. Title page: the SAME video carries on, only the metadata changed');
    await page.waitForTimeout(1500);
    const atTap = (await carried(page))!.time;
    await say(page, `5. Press Play (${atTap.toFixed(1)} s) → the player`);
    await heroButton(page, 'play').click();
    await expect(page).toHaveURL(/\/play\//);
    const handoff = await page.evaluate(() => (history.state?.usr?.handoff ?? null) as { at: number | null } | null);
    await say(
      page,
      `6. Player: the video carries on, then the title takes over at ${handoff?.at?.toFixed(1) ?? '0'} s (Preview starts at + ${atTap.toFixed(1)} s)`,
    );
    await expect.poll(() => playerVideo(page).evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0);
    await page.waitForTimeout(4000);
  });
});
