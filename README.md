# Hidden Heritage London

A spatial data story for the CASA0028 group assignment. The app starts from the
official English Heritage blue plaques catalogue and then filters it into
`hidden` candidates using TfL access data and OSM visibility/environment
signals.

## Stack

- React + Vite
- Leaflet + CARTO Light basemap
- Official English Heritage plaque records
- TfL StopPoint API
- OpenStreetMap data via Overpass API

## Run locally

```bash
npm install
npm run dev
```

## Rebuild the datasets

```bash
npm run data:fetch-eh
npm run data:build-hidden
```

`data:fetch-eh` rebuilds the full English Heritage catalogue.

`data:build-hidden` enriches it with:

- nearest TfL station and access metadata
- OSM tourism context
- green-space and major-road proximity
- `hidden_core` and `hidden_quiet` flags
- curated route assignments

## Main data files

- `public/english-heritage-blue-plaques.geojson`
  Full official catalogue, currently 1028 plaques.
- `public/hidden-heritage-sites.geojson`
  Filter-ready dataset used by the app.

## Hidden definition used in the app

- `hidden_core`
  English Heritage plaque + no OSM tourism POI within 50m + at most 3 tourism
  POIs within 500m + within 800m of a TfL station.
- `hidden_quiet`
  `hidden_core` + green-space centroid within 400m + major road farther than
  100m.

## Build for GitHub Pages

1. Update `base` in `vite.config.js` if needed.
2. `npm run build`
3. `npm run deploy`
