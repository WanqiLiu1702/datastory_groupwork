# Data Inventory

This folder separates downloaded source data, app runtime data, and archived
reference files.

## Folder layout

### `source/`

Downloaded or externally sourced data used to build the prototype.

- `source/english-heritage/english-heritage-blue-plaques.geojson`
  Full official English Heritage blue plaques catalogue fetched by
  `npm run data:fetch-eh`.
- `source/tfl/tfl-stations.kml`
  Reference TfL station geometry export kept in the repo for handoff.
- `source/tfl/tfl-station-facilities.xml`
  Reference TfL station facilities export kept in the repo for handoff.

### `archive/`

Files not used by the live app, but kept as background reference.

- `archive/sample-plaques.json`
  Early sample dataset from the initial prototype stage. Do not use this for
  the live app.

## Runtime data location

The app itself reads from `public/data/`, not from this folder.

- `public/data/processed/hidden-heritage-sites.geojson`
- `public/data/processed/site-context.json`
- `public/data/boundaries/greater-london-boundary.json`
- `public/data/boundaries/london-boroughs.geojson`

## Rebuild logic

1. `scripts/fetch-english-heritage-blue-plaques.mjs`
   Writes the official plaque source file into `data/source/english-heritage/`.
2. `scripts/build-hidden-heritage-dataset.mjs`
   Reads the English Heritage source file, fetches TfL + OSM context, and
   writes processed runtime outputs into `public/data/processed/`.

## Important handling rule

If you want to change filtering logic, route logic, or enrichment rules:

- edit the scripts first
- then rerun `npm run data:build-hidden`

Do not treat processed runtime files as the source of truth.
