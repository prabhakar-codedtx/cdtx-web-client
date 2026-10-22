# Cdtx web client

A web viewer for the Cdtx-CMS delivery API. It draws **only from the API's JSON**: the tabs, every screen, each rail's
cards (their layers, frames, sizes, colours, icons, texts, layout rules), the page spacing and fonts. No design value lives
in the client. It is also an installable PWA (tablet, mobile, TV browsers).

## Run

```bash
npm install
npm run dev        # http://localhost:3100, /v1 is proxied to the delivery API
npm run build
```

Settings (`.env`, see `.env.example`): `VITE_PRODUCT` (the product key), `VITE_DEFAULT_REGION`, `VITE_DEFAULT_LOCALE`,
`VITE_PROXY_TARGET` (where the dev proxy sends `/v1`; default the live server), optional `VITE_API_URL`, `VITE_DT`,
`VITE_DETAIL_PAGES`.

## How it works

1. `GET /v1/launch/config` is the only address built in. It returns the addresses of the other calls, and the
   `forceUpdate` / maintenance flags (`src/lib/api/endpoints.ts`, `src/screens/Shell.tsx`).
2. The tabs call fills the tab bar (`TopNav`); `/` opens the tab with `is_default`.
3. A screen is `GET {pageURL}`: `PageScreen` draws the hero, then the rails in order, with the page's `spacing`,
   `background` and `typography`. A rail's titles come from its own `sources[0].content_url`, asked when the rail nears the
   screen (`src/screens/Rail.tsx`).
4. A card (`src/render/CardView.tsx`, `Parts.tsx`) is drawn from its `card_component`: the layers of
   `presentation.stack`, each part at its `frame`, lengths from the part's final `px` (or, from a server that does not send
   them yet, the design size times `scale`), times the card's `fit`. `layoutRules` are solved with the shared resolver
   (`src/lib/layout`, the same cases as `docs/layout-rules/conformance/resolve.json` in the CMS repo).
5. Tapping a card opens `/title/:type/:id`: the detail page for that kind of title (`VITE_DETAIL_PAGES`), asked with
   `contentId`. Play opens the title; there is no stream address in the delivery API yet.

The device it asks as (`dt`) is `web`, `mobileweb` in a window under 768 px, `androidtv` in an Android TV browser.

## What is not in the JSON yet (so not in the client)

- Detail pages are not listed anywhere, so the client is told which page opens for which kind of title.
- Playback, user actions (like, watchlist) and watch progress have no API.
- A picture part's own size (`px.width` and `px.height`) is only sent once the server version that adds the final sizes is
  deployed; until then it falls back to the design size.
