# Project Handoff

This note is for anyone taking over the project after cloning the repository.

## What this prototype currently does

- Loads a processed hidden-heritage dataset built from official English
  Heritage blue plaques
- Filters places by theme, borough, context, hidden definition and quietness
- Shows context layers for tourism, green space, water and major roads
- Supports persona-led route browsing with route legs and walking-path previews
- Includes a prototype-only `Uncover Stories` contribution flow

## Main architectural split

### 1. Landing / narrative layer

- `src/components/HeroLanding.jsx`
- intro basemap in `src/components/IntroMap.jsx`

This is the first-entry layer and should stay visually light. It is mainly for
mode selection:

- Explore Hidden Gems
- Plan Your Route
- Uncover Stories
- About us

### 2. Explore mode

- `src/components/Sidebar.jsx`
- `src/components/CategoryMixPanel.jsx`
- `src/components/RankingPanel.jsx`
- `src/components/ResultList.jsx`

This is the filters-first interface.

### 3. Route mode

- `src/components/ExplorerPanels.jsx`
- `src/components/HeritageMap.jsx`

This is now more route-first than before, but it can still be pushed further so
that route planning feels fully separate from place browsing.

### 4. Shared map layer

- `src/components/HeritageMap.jsx`

Responsibilities:

- marker rendering
- selected-site popup and access rings
- route line rendering
- route station markers
- borough / London boundary rendering
- context layer rendering
- map control state

## Data flow

### App runtime

`src/App.jsx` loads:

- `public/data/processed/hidden-heritage-sites.geojson`
- `public/data/processed/site-context.json`
- `public/data/boundaries/greater-london-boundary.json`
- `public/data/boundaries/london-boroughs.geojson`

### Source / build pipeline

- `scripts/fetch-english-heritage-blue-plaques.mjs`
  Fetches the official catalogue from English Heritage.
- `scripts/build-hidden-heritage-dataset.mjs`
  Enriches the source catalogue with TfL + OSM context and writes the app-ready
  outputs.

## Current known limitations

### Uncover Stories

`Uncover Stories` is still a local prototype draft flow only.

- it does not send data to a backend
- it does not publish suggested sites
- it would need moderation before becoming public

### Route definitions

Route definitions are currently hard-coded inside
`scripts/build-hidden-heritage-dataset.mjs` under `ROUTE_DEFS`.

If route strategy changes, update the script and rebuild the processed data.

### Map interaction

Wheel zoom is intentionally off by default so the page scroll remains usable.
Users can turn it on manually from the map.

## Recommended next steps

If a new teammate is continuing development, the most valuable next moves are:

1. Split `Explore` and `Route` into even clearer top-level modes
2. Decide whether `Uncover Stories` stays prototype-only or gets a real backend
3. Clean remaining UI polish issues:
   route hierarchy, typography consistency, and fewer competing surface styles
4. Remove or fix any remaining encoding / symbol glitches if they appear in the
   UI again

## Useful commands

```bash
npm install
npm run dev
npm run build
npm run data:fetch-eh
npm run data:build-hidden
npm run data:rebuild
```
