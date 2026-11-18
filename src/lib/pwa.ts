import { registerSW } from 'virtual:pwa-register';

/** How often an app left open (a TV on all day) asks whether a new version was deployed. */
const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * The service worker keeps the app's code so it opens fast and offline. A new deploy installs in the
 * background; with `autoUpdate` it takes over at once and this reloads the page, so a viewer gets the new
 * version on the visit it was found on - not one visit later, with the old code reading the new answers.
 */
export function startServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        // Not while offline: the check would only fail.
        if (navigator.onLine) void registration.update();
      }, CHECK_EVERY_MS);
    },
  });
}
