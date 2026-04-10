# GemMap: London's Hidden Heritage Beyond Guidebooks

Interactive React + Leaflet prototype for the CASA0028 group assignment.

The project starts from the official English Heritage Blue Plaques dataset and
re-filters it through TfL accessibility and OSM context to surface culturally
significant but less visible heritage sites in London.

Live site:

- <https://wanqiliu1702.github.io/datastory_groupwork/>

## Quick start

```bash
npm install
npm run dev
```

Build production output:

```bash
npm run build
```

## Data rebuild workflow

Rebuild the project datasets from source:

```bash
npm run data:fetch-eh
npm run data:build-hidden
```

Or run the full pipeline:

```bash
npm run data:rebuild
```

What each script does:

- `data:fetch-eh`
  Downloads the full official English Heritage blue plaques catalogue into
  `data/source/english-heritage/`.
- `data:build-hidden`
  Reads the English Heritage source file, enriches it with TfL + OSM context,
  and writes the app-ready datasets into `public/data/processed/`.

## Repository structure

```text
hidden-heritage-vite/
├─ .github/workflows/          GitHub Pages deployment
├─ data/
│  ├─ archive/                 Legacy/sample data kept for reference only
│  ├─ source/                  Downloaded source datasets
│  │  ├─ english-heritage/
│  │  └─ tfl/
│  └─ README.md                Data inventory and provenance notes
├─ public/
│  └─ data/
│     ├─ boundaries/           Runtime boundary datasets used by the app
│     └─ processed/            Runtime processed datasets used by the app
├─ scripts/                    Data fetch + build scripts
├─ src/                        React application
└─ docs/
   └─ HANDOFF.md               Architecture + takeover notes
```

## Runtime data used by the app

- `public/data/processed/hidden-heritage-sites.geojson`
  Main dataset used by the UI.
- `public/data/processed/site-context.json`
  Nearby tourism / green / water / road context for selected sites.
- `public/data/boundaries/greater-london-boundary.json`
  Greater London outline.
- `public/data/boundaries/london-boroughs.geojson`
  London borough boundaries.

## Core app structure

- `src/App.jsx`
  Top-level state, filtering, experience modes, data loading.
- `src/components/HeroLanding.jsx`
  Landing page and entry modes.
- `src/components/HeritageMap.jsx`
  Leaflet map, markers, route line, context layers, map controls.
- `src/components/Sidebar.jsx`
  Explore-mode filters and ranking panel.
- `src/components/ExplorerPanels.jsx`
  Route guide and places drawer UI.
- `src/components/StoryContributionSection.jsx`
  Prototype contribution flow for missing heritage stories.

## Hidden definition in the current prototype

- `hidden_core`
  Official plaque + no OSM tourism POI within 50m + at most 3 tourism POIs
  within 500m + within 800m of a TfL station.
- `hidden_quiet`
  `hidden_core` + green space within 400m + major road farther than 100m.

## Notes for contributors

- Do not manually edit files in `public/data/processed/` unless you are making a
  deliberate hotfix. Prefer updating the scripts in `scripts/` and rebuilding.
- The current `Uncover Stories` flow is a prototype only. It does not submit to
  a live backend.
- Route definitions currently live inside
  `scripts/build-hidden-heritage-dataset.mjs` as `ROUTE_DEFS`.

## Handoff docs

- [Project handoff](./docs/HANDOFF.md)
- [Data inventory](./data/README.md)
