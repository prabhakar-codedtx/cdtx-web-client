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

The client reads **schema 3** (the server's default), as described in the CMS repo's `docs/client-contract/`
(`RENDERING-GUIDE.md`, `KEYS-EXPLAINED.md`, `SCHEMA-3-KEYS.md`). Types: `src/lib/api/types.ts`.

1. `GET /v1/launch/config?product_id=&device=&reg=` is the only address built in. It returns the addresses of the other
   calls and the `forceUpdate` / maintenance flags (`src/lib/api/endpoints.ts`, `src/screens/Shell.tsx`).
2. `GET {designSystemURL}`: the fonts to load and `defaultFontFamily` (for text whose `fontFamily` is null). Kept in
   `localStorage` by its address, whose `v` changes only when the Design System does.
3. The tabs call fills the tab bar (`TopNav`); `/` opens the tab with `isDefault`.
4. A screen is `GET {pageURL}`: `PageScreen` paints `background` (a `Fill`), then draws `rails` in order, the hero first
   (`layout: hero`, `HeroBanner`), the rows `spacing.railGap` apart with `spacing.railPadding` around each. A rail with
   `source.count` 0 is skipped and its URL never called. More rows (`paging.nextStart`) load near the bottom.
5. A rail (`src/screens/Rail.tsx`) draws `blocks[rail.blockKey]` once per title, its titles from `source.contentUrl` (as
   sent, when the rail nears the screen), its card size from `railLayout` (`designed`, `exact` / `tier`, `count`, and
   `banner`: every card fits across, no scrolling), plus `titleStyle`, `seeAll`, `grid.maxRows`, header / footer blocks.
6. A card (`src/render/CardView.tsx`, `Parts.tsx`): the layers of `card.stack` (background `Fill`, inset image, `shade`
   gradients, `border`), each atom at its `frame`, components by their `autoLayout`, every length times the card's `fit`.
   An atom is drawn only if `showWhen` is null or the title has that badge; hidden atoms take no room.
   `layoutRules` are solved with the shared resolver (`src/lib/layout`).
7. A tap uses `rail.tap.cards[title.id]`, else `rail.tap.card`; `detail` opens `/title/:type/:id` (the detail page for
   that kind of title, `VITE_DETAIL_PAGES`, asked with `contentId`). An atom's `action` (play, more_info) acts on its title.
   There is no stream address in the delivery API yet.

The device it asks as (`dt`) is `web`, `mobileweb` in a window under 768 px, `androidtv` in an Android TV browser.

## The player (`/play/:type/:id`)

Play (an atom's `play` action, or a rail whose `tap.card.type` is `player`) opens the player. Its controls come from the
player config, `GET /v1/player-config/{product}?dt=` (the CMS repo's `docs/player-config-client/README.md`), in
`src/player/`:

- `usePlayerConfig` asks for it when the player opens. The last good copy is kept with its `ETag` (sent back in
  `If-None-Match`; 304 reuses it; any failure falls back to it). `404` means no player is published: the browser's own
  player is shown. While that is so, a development build (or `VITE_PLAYER_SAMPLE=on`) shows the backend's sample layout
  (`src/player/samples`) and says so.
- `PlayerControls` places every control at its `frame` (fractions of the 16:9 surface, minus `surface.safe`), scales
  lengths by `width / surface.design.w`, draws its `look` (a schema 3 atom, with the same `AtomView` as the cards) or a
  plain button when it has none, measures, then solves `ties` and applies `limits`. A control is drawn only when the
  browser has what it `requires` (fullscreen, pip; no cast) and its `showWhen` holds. `ad.controls` replace the controls
  while an ad plays. `behaviour`: hide after `autoHideSeconds`, `initialFocus` and arrow keys along `focusOrder` on a
  remote, `seekStepSeconds`, and hit zones of at least `minTarget`.
- `Panel` opens Quality, Audio, Subtitles, Audio and subtitles, Speed, Settings and Episodes where
  `panelContract.placement[panel.opens]` says, fills them from `panel.data` and the stream, starts focus on the selected
  option, closes on Back, and returns focus to the button. A panel design (`panels`) is used when its atoms carry the
  contract's roles; otherwise the panel is a plain list.
- `useMedia` is the `<video>` the controls drive. The delivery API has no stream address yet, so it plays the title's
  `previewVideoUrl`; without one the title's picture stands in.

## What is not in the JSON yet (so not in the client)

- Detail pages are not listed anywhere, so the client is told which page opens for which kind of title.
- Playback, user actions (like, watchlist) and watch progress have no API.
- The Top 10 rank numeral (`block.rank`) has a colour and a style but no size, stroke width or place.
- Player: the launch config has no `playerConfigURL` (the client uses the guide's address); no stream address, intro
  markers, next episode or season's episodes reach the client, so Skip Intro, Next episode and Episodes stay hidden; the
  delivered panel designs carry no roles or `repeat` marks, so panels are drawn as plain lists.
