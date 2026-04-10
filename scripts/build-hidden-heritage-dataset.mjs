import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const INPUT_PATH = path.join(ROOT, 'public', 'english-heritage-blue-plaques.geojson');
const OUTPUT_PATH = path.join(ROOT, 'public', 'hidden-heritage-sites.geojson');
const CACHE_DIR = path.join(ROOT, 'data-cache');

const TFL_STOPPOINTS_URL =
  'https://api.tfl.gov.uk/StopPoint/Mode/tube,dlr,overground,elizabeth-line';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const MAJOR_ROAD_TYPES = ['motorway', 'trunk', 'primary', 'secondary'];
const ACCOMMODATION_TOURISM_TYPES = new Set([
  'alpine_hut',
  'apartment',
  'camp_pitch',
  'camp_site',
  'caravan_site',
  'chalet',
  'guest_house',
  'hostel',
  'hotel',
  'motel',
  'resort',
  'wilderness_hut'
]);

const ROUTE_DEFS = {
  bloomsbury_backstreets: {
    label: 'Bloomsbury Backstreets',
    description: 'Writers, artists and thinkers in Camden and Westminster away from the main tourist trail.',
    color: '#6c7a52'
  },
  west_london_creatives: {
    label: 'West London Creatives',
    description: 'Overlooked arts and design plaques across Chelsea, Kensington and riverside streets.',
    color: '#9b5a43'
  },
  civic_voices: {
    label: 'Civic Voices',
    description: 'Politicians, campaigners and scientists whose plaques sit in accessible but overlooked neighbourhoods.',
    color: '#476c8a'
  },
  garden_suburb_retreats: {
    label: 'Garden Suburb Retreats',
    description: 'Quieter residential plaques near parks and side streets across outer London.',
    color: '#7a5d8f'
  }
};

const EARTH_RADIUS_M = 6371000;
const LONDON_LAT0_RAD = 51.51 * Math.PI / 180;

function radians(value) {
  return value * Math.PI / 180;
}

function haversineMeters(aLat, aLon, bLat, bLon) {
  const dLat = radians(bLat - aLat);
  const dLon = radians(bLon - aLon);
  const lat1 = radians(aLat);
  const lat2 = radians(bLat);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function projectToMeters(lat, lon) {
  return {
    x: EARTH_RADIUS_M * radians(lon) * Math.cos(LONDON_LAT0_RAD),
    y: EARTH_RADIUS_M * radians(lat)
  };
}

function pointToSegmentDistanceMeters(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy))
  );
  const closestX = start.x + t * dx;
  const closestY = start.y + t * dy;
  return Math.hypot(point.x - closestX, point.y - closestY);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\b(underground|station|rail|dlr|overground|elizabeth line)\b/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function uniqueBy(items, keyFn) {
  const seen = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  return [...seen.values()];
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

async function withRetry(task, label, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt === attempts) {
        throw new Error(`${label} failed after ${attempt} attempts: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  throw new Error(`${label} failed unexpectedly`);
}

function buildBBox(features) {
  const coords = features.map(feature => feature.geometry.coordinates);
  const lons = coords.map(coord => coord[0]);
  const lats = coords.map(coord => coord[1]);
  return {
    south: Math.min(...lats) - 0.03,
    west: Math.min(...lons) - 0.03,
    north: Math.max(...lats) + 0.03,
    east: Math.max(...lons) + 0.03
  };
}

function bboxToString(bbox) {
  return `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
}

function parseAdditionalProperties(additionalProperties = []) {
  const record = {};
  for (const item of additionalProperties) {
    const key = `${item.category}:${item.key}`;
    record[key] = item.value;
  }
  return record;
}

function normalizeTfLStations(stopPoints, bbox) {
  const filtered = stopPoints.filter(stopPoint => {
    if (stopPoint.lat == null || stopPoint.lon == null) return false;
    if (!stopPoint.lines?.length && !stopPoint.lineModeGroups?.some(group => group.lineIdentifier?.length)) {
      return false;
    }
    if (!/Station$/i.test(stopPoint.commonName || '')) return false;
    return (
      stopPoint.lat >= bbox.south &&
      stopPoint.lat <= bbox.north &&
      stopPoint.lon >= bbox.west &&
      stopPoint.lon <= bbox.east
    );
  });

  const byStation = new Map();
  for (const stopPoint of filtered) {
    const key = stopPoint.stationNaptan || stopPoint.id;
    const additional = parseAdditionalProperties(stopPoint.additionalProperties);
    const candidate = {
      id: key,
      name: stopPoint.commonName,
      lat: stopPoint.lat,
      lon: stopPoint.lon,
      modes: stopPoint.modes || [],
      lines: uniqueBy(
        (stopPoint.lines || []).map(line => ({
          id: line.id,
          name: line.name,
          mode: line.modeName || stopPoint.modes?.[0] || null
        })),
        line => line.id
      ),
      zone: additional['Geo:Zone'] || null,
      accessViaLift: (additional['Accessibility:AccessViaLift'] || '').toLowerCase() === 'yes',
      wifi: (additional['Facility:WiFi'] || '').toLowerCase() === 'yes'
    };

    const current = byStation.get(key);
    if (!current || candidate.lines.length > current.lines.length) {
      byStation.set(key, candidate);
    }
  }

  return [...byStation.values()];
}

function tourismAllowed(tags = {}) {
  const tourism = tags.tourism;
  if (!tourism) return false;
  return !ACCOMMODATION_TOURISM_TYPES.has(tourism);
}

function normalizePointElements(elements, allowElement) {
  return elements
    .filter(element => allowElement(element.tags || {}))
    .map(element => {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (lat == null || lon == null) return null;
      return {
        id: `${element.type}/${element.id}`,
        lat,
        lon,
        tags: element.tags || {}
      };
    })
    .filter(Boolean);
}

function normalizeRoadElements(elements) {
  return elements
    .filter(element => element.type === 'way' && MAJOR_ROAD_TYPES.includes(element.tags?.highway))
    .map(element => {
      const geometry = element.geometry || [];
      if (geometry.length < 2) return null;
      return {
        id: `way/${element.id}`,
        highway: element.tags.highway,
        name: element.tags.name || null,
        segments: geometry.slice(1).map((point, index) => ({
          start: projectToMeters(geometry[index].lat, geometry[index].lon),
          end: projectToMeters(point.lat, point.lon)
        }))
      };
    })
    .filter(Boolean);
}

function lineNames(lines = []) {
  return uniqueBy(lines, line => line.id).map(line => line.name);
}

function nearestStation(plaque, stations) {
  let winner = null;
  for (const station of stations) {
    const distance = haversineMeters(
      plaque.geometry.coordinates[1],
      plaque.geometry.coordinates[0],
      station.lat,
      station.lon
    );
    if (!winner || distance < winner.distance) {
      winner = { station, distance };
    }
  }
  return winner;
}

function tourismMetrics(plaque, tourismPoints) {
  const lat = plaque.geometry.coordinates[1];
  const lon = plaque.geometry.coordinates[0];
  let count50 = 0;
  let count500 = 0;
  let nearest = Infinity;
  for (const point of tourismPoints) {
    const distance = haversineMeters(lat, lon, point.lat, point.lon);
    if (distance < nearest) nearest = distance;
    if (distance <= 50) count50 += 1;
    if (distance <= 500) count500 += 1;
  }
  return {
    tourism50m: count50,
    tourism500m: count500,
    nearestTourismM: Number.isFinite(nearest) ? Math.round(nearest) : null
  };
}

function nearestGreenDistance(plaque, greenPoints) {
  const lat = plaque.geometry.coordinates[1];
  const lon = plaque.geometry.coordinates[0];
  let nearest = Infinity;
  for (const point of greenPoints) {
    const distance = haversineMeters(lat, lon, point.lat, point.lon);
    if (distance < nearest) nearest = distance;
  }
  return Number.isFinite(nearest) ? Math.round(nearest) : null;
}

function nearestRoadDistance(plaque, roadWays) {
  const point = projectToMeters(plaque.geometry.coordinates[1], plaque.geometry.coordinates[0]);
  let nearest = Infinity;
  for (const road of roadWays) {
    for (const segment of road.segments) {
      const distance = pointToSegmentDistanceMeters(point, segment.start, segment.end);
      if (distance < nearest) nearest = distance;
    }
  }
  return Number.isFinite(nearest) ? Math.round(nearest) : null;
}

function environmentScore(greenDistance, roadDistance, tourism500m) {
  let score = 3;
  if (greenDistance != null && greenDistance <= 400) score += 1;
  if (roadDistance != null && roadDistance > 120) score += 1;
  if (roadDistance != null && roadDistance < 60) score -= 1;
  if (tourism500m > 6) score -= 1;
  return Math.max(1, Math.min(5, score));
}

function visitorDensity(tourism500m) {
  if (tourism500m <= 1) return 'low';
  if (tourism500m <= 5) return 'medium';
  return 'high';
}

function hiddenReasons(metrics) {
  const reasons = [];
  if (metrics.tourism50m === 0) reasons.push('Absent from the OSM tourism layer at the site itself');
  if (metrics.tourism500m <= 3) reasons.push('Very few tourism POIs nearby');
  if (metrics.stationDistanceM <= 800) reasons.push(`Within walking distance of ${metrics.nearestStation}`);
  if (metrics.greenSpaceDistanceM != null && metrics.greenSpaceDistanceM <= 400) {
    reasons.push('Near urban green space');
  }
  if (metrics.majorRoadDistanceM != null && metrics.majorRoadDistanceM > 100) {
    reasons.push('Set back from major roads');
  }
  return reasons;
}

function assignRoutes(properties) {
  const routes = [];
  const [lon, lat] = properties.coordinates;
  const borough = properties.borough || '';

  if (
    properties.hidden_core &&
    /Camden|Westminster/i.test(borough) &&
    ['literature', 'science', 'arts_music'].includes(properties.category)
  ) {
    routes.push('bloomsbury_backstreets');
  }

  if (
    properties.hidden_core &&
    ['arts_music', 'architecture'].includes(properties.category) &&
    /Kensington|Chelsea|Hammersmith|Wandsworth|Westminster/i.test(borough)
  ) {
    routes.push('west_london_creatives');
  }

  if (
    properties.hidden_core &&
    ['politics_reform', 'science'].includes(properties.category) &&
    /Camden|Westminster|Wandsworth|Lambeth|Southwark|Hackney|Islington/i.test(borough)
  ) {
    routes.push('civic_voices');
  }

  if (
    properties.hidden_core &&
    /Barnet|Harrow|Enfield|Redbridge|Waltham Forest|Croydon|Lewisham|Hounslow|Merton|Brent|Ealing/i.test(borough)
  ) {
    routes.push('garden_suburb_retreats');
  }

  return routes;
}

async function loadOrFetchCache(cacheName, fetcher) {
  const cachePath = path.join(CACHE_DIR, cacheName);
  if (await fileExists(cachePath)) {
    return readJson(cachePath);
  }
  const value = await fetcher();
  await writeJson(cachePath, value);
  return value;
}

async function fetchOverpass(query, cacheName) {
  return loadOrFetchCache(cacheName, async () => {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        return await withRetry(
          () =>
            fetchJson(endpoint, {
              method: 'POST',
              headers: {
                'content-type': 'text/plain;charset=UTF-8',
                'user-agent': 'Codex Hidden Heritage Coursework/1.0'
              },
              body: query
            }),
          `Overpass query via ${endpoint}`,
          2
        );
      } catch (error) {
        if (endpoint === OVERPASS_ENDPOINTS.at(-1)) throw error;
      }
    }
    throw new Error('All Overpass endpoints failed');
  });
}

async function main() {
  const official = JSON.parse(await fs.readFile(INPUT_PATH, 'utf8'));
  const bbox = buildBBox(official.features);
  const bboxText = bboxToString(bbox);

  const tflRaw = await loadOrFetchCache('tfl-stop-points.json', () =>
    withRetry(() => fetchJson(TFL_STOPPOINTS_URL), 'TfL StopPoint request')
  );

  const tourismQuery = `
[out:json][timeout:300];
(
  nwr["tourism"]["tourism"!~"hotel|guest_house|hostel|motel|apartment|camp_site|camp_pitch|caravan_site|resort|chalet|alpine_hut|wilderness_hut"](${bboxText});
);
out center tags;
  `.trim();

  const greenQuery = `
[out:json][timeout:300];
(
  nwr["leisure"~"park|garden|nature_reserve|recreation_ground|common"](${bboxText});
  nwr["landuse"~"recreation_ground|village_green|grass|meadow"](${bboxText});
  nwr["natural"~"wood|grassland|heath|scrub|wetland"](${bboxText});
);
out center tags;
  `.trim();

  const roadQuery = `
[out:json][timeout:300];
(
  way["highway"~"motorway|trunk|primary|secondary"](${bboxText});
);
out geom tags;
  `.trim();

  const [tourismRaw, greenRaw, roadsRaw] = await Promise.all([
    fetchOverpass(tourismQuery, 'osm-tourism.json'),
    fetchOverpass(greenQuery, 'osm-green-spaces.json'),
    fetchOverpass(roadQuery, 'osm-major-roads.json')
  ]);

  const stations = normalizeTfLStations(tflRaw.stopPoints || [], bbox);
  const tourismPoints = normalizePointElements(tourismRaw.elements || [], tourismAllowed);
  const greenPoints = normalizePointElements(greenRaw.elements || [], () => true);
  const roadWays = normalizeRoadElements(roadsRaw.elements || []);

  const counts = {
    hiddenCore: 0,
    hiddenQuiet: 0,
    routes: Object.fromEntries(Object.keys(ROUTE_DEFS).map(key => [key, 0]))
  };

  const features = official.features.map(feature => {
    const nearest = nearestStation(feature, stations);
    const tourism = tourismMetrics(feature, tourismPoints);
    const greenDistance = nearestGreenDistance(feature, greenPoints);
    const roadDistance = nearestRoadDistance(feature, roadWays);
    const stationDistanceM = nearest ? Math.round(nearest.distance) : null;
    const stationLines = nearest ? lineNames(nearest.station.lines) : [];
    const accessible = stationDistanceM != null && stationDistanceM <= 800;
    const hiddenCore =
      tourism.tourism50m === 0 &&
      tourism.tourism500m <= 3 &&
      accessible;
    const hiddenQuiet =
      hiddenCore &&
      greenDistance != null &&
      greenDistance <= 400 &&
      roadDistance != null &&
      roadDistance > 100;

    const hiddenScore =
      (tourism.tourism50m === 0 ? 2 : 0) +
      (tourism.tourism500m <= 3 ? 1 : 0) +
      (accessible ? 1 : 0) +
      (greenDistance != null && greenDistance <= 400 ? 1 : 0) +
      (roadDistance != null && roadDistance > 100 ? 1 : 0);

    const envScore = environmentScore(greenDistance, roadDistance, tourism.tourism500m);
    const density = visitorDensity(tourism.tourism500m);

    const props = {
      ...feature.properties,
      coordinates: feature.geometry.coordinates,
      category: feature.properties.category_group,
      type: 'historic_building',
      opening_status: 'always_visible',
      opening_info:
        'Blue plaque visible from the street. Building access varies and should be checked separately.',
      nearest_station: nearest?.station.name || null,
      station_distance_m: stationDistanceM,
      station_lines: stationLines,
      station_modes: nearest?.station.modes || [],
      station_zone: nearest?.station.zone || null,
      station_access_via_lift: nearest?.station.accessViaLift || false,
      accessible_walkable: accessible,
      osm_tourism_50m: tourism.tourism50m,
      osm_tourism_500m: tourism.tourism500m,
      nearest_tourism_m: tourism.nearestTourismM,
      green_space_distance_m: greenDistance,
      major_road_distance_m: roadDistance,
      environment_score: envScore,
      environment_tags: [
        greenDistance != null && greenDistance <= 400 ? 'near_green_space' : null,
        roadDistance != null && roadDistance > 100 ? 'away_from_major_roads' : null,
        tourism.tourism500m <= 1 ? 'low_tourism_context' : null,
        accessible ? 'walkable_from_tfl' : null,
        nearest?.station.accessViaLift ? 'step_free_station_nearby' : null
      ].filter(Boolean),
      visitor_density: density,
      hidden_score: hiddenScore,
      hidden_core: hiddenCore,
      hidden_quiet: hiddenQuiet,
      hidden_reasons: hiddenReasons({
        tourism50m: tourism.tourism50m,
        tourism500m: tourism.tourism500m,
        stationDistanceM,
        nearestStation: nearest?.station.name || 'public transport',
        greenSpaceDistanceM: greenDistance,
        majorRoadDistanceM: roadDistance
      }),
      data_sources: {
        official: 'English Heritage Blue Plaques',
        access: 'TfL StopPoint API',
        visibility_context: 'OpenStreetMap via Overpass API'
      }
    };

    props.routes = assignRoutes(props);
    for (const route of props.routes) counts.routes[route] += 1;
    if (hiddenCore) counts.hiddenCore += 1;
    if (hiddenQuiet) counts.hiddenQuiet += 1;

    delete props.coordinates;

    return {
      type: 'Feature',
      geometry: feature.geometry,
      properties: props
    };
  });

  const output = {
    type: 'FeatureCollection',
    metadata: {
      title: 'Hidden Heritage London',
      created_at: new Date().toISOString(),
      source_count: official.features.length,
      hidden_core_count: counts.hiddenCore,
      hidden_quiet_count: counts.hiddenQuiet,
      filters: {
        hidden_core: 'English Heritage plaque AND absent from OSM tourism layer within 50m AND <=3 tourism POIs within 500m AND within 800m of a TfL station',
        hidden_quiet: 'hidden_core AND green-space centroid within 400m AND major road farther than 100m'
      },
      routes: ROUTE_DEFS
    },
    features
  };

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        output: OUTPUT_PATH,
        sourceCount: official.features.length,
        hiddenCore: counts.hiddenCore,
        hiddenQuiet: counts.hiddenQuiet,
        routeCounts: counts.routes,
        stations: stations.length,
        tourismPoints: tourismPoints.length,
        greenPoints: greenPoints.length,
        roadWays: roadWays.length
      },
      null,
      2
    )
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
