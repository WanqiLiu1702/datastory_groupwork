import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const INPUT_PATH = path.join(ROOT, 'data', 'source', 'english-heritage', 'english-heritage-blue-plaques.geojson');
const OUTPUT_PATH = path.join(ROOT, 'public', 'data', 'processed', 'hidden-heritage-sites.geojson');
const CONTEXT_OUTPUT_PATH = path.join(ROOT, 'public', 'data', 'processed', 'site-context.json');
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
    color: '#77805a',
    duration: '60-75 min walk',
    focus: 'Literary and scientific central London',
    why: 'Best when you want a compact central walk that still feels quieter than the usual museum-and-monument circuit.',
    selection: 'Chosen from core-hidden plaques in Camden and Westminster with literature, science or arts themes.',
    recommended_for: ['Experienced London Visitor', 'Community Heritage Advocate']
  },
  west_london_creatives: {
    label: 'West London Creatives',
    description: 'Overlooked arts and design plaques across Chelsea, Kensington and riverside streets.',
    color: '#b06f57',
    duration: '70-90 min walk',
    focus: 'Arts, music and architecture',
    why: 'Best for visitors who want a more design-led route with stronger neighbourhood character and fewer headline landmarks.',
    selection: 'Chosen from core-hidden arts and architecture plaques across west and inner-west London boroughs.',
    recommended_for: ['Experienced London Visitor']
  },
  civic_voices: {
    label: 'Civic Voices',
    description: 'Politicians, campaigners and scientists whose plaques sit in accessible but overlooked neighbourhoods.',
    color: '#5b7a93',
    duration: '45-60 min walk',
    focus: 'Politics, reform and public life',
    why: 'Works well if the user wants stories of public life, reform and citizenship rather than celebrity homes.',
    selection: 'Chosen from core-hidden politics and science plaques in inner boroughs with solid TfL access.',
    recommended_for: ['Community Heritage Advocate', 'Experienced London Visitor']
  },
  garden_suburb_retreats: {
    label: 'Garden Suburb Retreats',
    description: 'Quieter residential plaques near parks and side streets across outer London.',
    color: '#8979a0',
    duration: '75-105 min walk',
    focus: 'Residential calm and green edges',
    why: 'Good for users prioritising lower visitor pressure, greener surroundings and a calmer edge-of-city feel.',
    selection: 'Chosen from core-hidden plaques in outer boroughs where quieter residential patterns are more common.',
    recommended_for: ['Quiet Cultural Seeker', 'Experienced London Visitor']
  },
  literary_lives_walk: {
    label: 'Literary Lives Walk',
    description: 'Novelists, poets and editors clustered into a tighter route for visitors who want a theme-led walk.',
    color: '#9a685d',
    duration: '50-70 min walk',
    focus: 'Literature',
    why: 'Recommended for a single-theme walk where the user wants a strong narrative thread from stop to stop.',
    selection: 'Chosen from literature plaques with hidden-core status across central and inner-west London.',
    recommended_for: ['Experienced London Visitor']
  },
  riverside_quiet_edge: {
    label: 'Riverside Quiet Edge',
    description: 'Plaques close to river or canal settings where cultural memory meets calmer waterfront detours.',
    color: '#5f9099',
    duration: '55-75 min walk',
    focus: 'Water-adjacent hidden heritage',
    why: 'Useful for users who explicitly want culture plus a softer waterside atmosphere.',
    selection: 'Chosen from hidden-core plaques within 350m of mapped water features and with stronger environment scores.',
    recommended_for: ['Quiet Cultural Seeker']
  },
  parkside_pause: {
    label: 'Parkside Pause',
    description: 'Shorter quiet-hidden route favouring plaques near parks, commons and greener side streets.',
    color: '#7b9a68',
    duration: '35-50 min walk',
    focus: 'Green and quiet places',
    why: 'Recommended when the aim is a shorter, lower-stress walk close to greenery.',
    selection: 'Chosen from quiet-hidden plaques close to green space, favouring calmer park-edge contexts.',
    recommended_for: ['Quiet Cultural Seeker']
  },
  step_free_starter: {
    label: 'Step-Free Starter',
    description: 'A more accessible starter route using plaques near lift-served TfL stations and shorter walks.',
    color: '#5e6b81',
    duration: '30-45 min walk',
    focus: 'Shorter approach and easier station access',
    why: 'Useful as an easier entry route where access and simpler station approaches matter more than route length.',
    selection: 'Chosen from core-hidden plaques near lift-served stations with shorter walking distances.',
    recommended_for: ['Quiet Cultural Seeker', 'Experienced London Visitor']
  },
  science_invention_loop: {
    label: 'Science & Invention Loop',
    description: 'Doctors, inventors and experimenters gathered into a more theme-led hidden-heritage route.',
    color: '#83a6cf',
    duration: '45-65 min walk',
    focus: 'Science and innovation',
    why: 'Recommended for users who want a tighter knowledge-and-discovery theme rather than a mixed cultural walk.',
    selection: 'Chosen from hidden-core science plaques with good TfL access in central and inner London.',
    recommended_for: ['Experienced London Visitor', 'Community Heritage Advocate']
  },
  campaigns_and_reform: {
    label: 'Campaigns & Reform',
    description: 'Campaigners, civic thinkers and reformers linked through accessible but less-promoted London streets.',
    color: '#d48c77',
    duration: '45-65 min walk',
    focus: 'Politics and reform',
    why: 'Works well when the user wants places tied to protest, policy, reform or civic change.',
    selection: 'Chosen from hidden-core politics and reform plaques with low tourism pressure and walkable stations.',
    recommended_for: ['Community Heritage Advocate', 'Experienced London Visitor']
  },
  music_performance_circuit: {
    label: 'Music & Performance Circuit',
    description: 'Performers, composers and cultural figures across inner-west and central London.',
    color: '#e3a77e',
    duration: '50-70 min walk',
    focus: 'Arts and performance',
    why: 'Recommended for a more lively creative-history route that still avoids the most overexposed visitor hotspots.',
    selection: 'Chosen from hidden-core arts and music plaques in borough clusters with walkable TfL access.',
    recommended_for: ['Experienced London Visitor']
  },
  outer_london_pioneers: {
    label: 'Outer London Pioneers',
    description: 'A broader route of writers, scientists and explorers in less central borough settings.',
    color: '#94bd8d',
    duration: '70-95 min walk',
    focus: 'Outer-London discovery',
    why: 'Good when the user wants to see how hidden heritage extends beyond the familiar central borough core.',
    selection: 'Chosen from hidden-core plaques in outer boroughs with literature, science or exploration themes.',
    recommended_for: ['Experienced London Visitor', 'Community Heritage Advocate']
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
        path: geometry.map(point => [point.lat, point.lon]),
        segments: geometry.slice(1).map((point, index) => ({
          index,
          startLat: geometry[index].lat,
          startLon: geometry[index].lon,
          endLat: point.lat,
          endLon: point.lon,
          start: projectToMeters(geometry[index].lat, geometry[index].lon),
          end: projectToMeters(point.lat, point.lon)
        }))
      };
    })
    .filter(Boolean);
}

function roadSnippet(path, segmentIndex, radius = 5) {
  const start = Math.max(0, segmentIndex - radius);
  const end = Math.min(path.length, segmentIndex + radius + 2);
  return path.slice(start, end);
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

function labelFromTags(tags, fallbacks, fallbackLabel) {
  for (const key of fallbacks) {
    if (tags[key]) return tags[key];
  }
  return fallbackLabel;
}

function sortByDistance(items, limit) {
  return items
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, limit);
}

function tourismMetrics(plaque, tourismPoints) {
  const lat = plaque.geometry.coordinates[1];
  const lon = plaque.geometry.coordinates[0];
  let count50 = 0;
  let count500 = 0;
  let nearest = Infinity;
  const nearby = [];
  for (const point of tourismPoints) {
    const distance = haversineMeters(lat, lon, point.lat, point.lon);
    if (distance < nearest) nearest = distance;
    if (distance <= 50) count50 += 1;
    if (distance <= 500) {
      count500 += 1;
      nearby.push({
        id: point.id,
        lat: point.lat,
        lon: point.lon,
        distance_m: Math.round(distance),
        label: labelFromTags(point.tags, ['name', 'tourism', 'information'], 'Tourism feature'),
        type: labelFromTags(point.tags, ['tourism', 'information'], 'tourism')
      });
    }
  }
  return {
    tourism50m: count50,
    tourism500m: count500,
    nearestTourismM: Number.isFinite(nearest) ? Math.round(nearest) : null,
    nearby: sortByDistance(nearby, 12)
  };
}

function nearestContextPoints(plaque, points, radiusM, limit, fallbacks, fallbackLabel) {
  const lat = plaque.geometry.coordinates[1];
  const lon = plaque.geometry.coordinates[0];
  let nearest = Infinity;
  const nearby = [];
  for (const point of points) {
    const distance = haversineMeters(lat, lon, point.lat, point.lon);
    if (distance < nearest) nearest = distance;
    if (distance <= radiusM) {
      nearby.push({
        id: point.id,
        lat: point.lat,
        lon: point.lon,
        distance_m: Math.round(distance),
        label: labelFromTags(point.tags, ['name', ...fallbacks], fallbackLabel),
        type: labelFromTags(point.tags, fallbacks, fallbackLabel)
      });
    }
  }
  return {
    nearestDistanceM: Number.isFinite(nearest) ? Math.round(nearest) : null,
    nearby: sortByDistance(nearby, limit)
  };
}

function nearestRoadContext(plaque, roadWays) {
  const point = projectToMeters(plaque.geometry.coordinates[1], plaque.geometry.coordinates[0]);
  let nearest = null;
  const nearbyByRoad = new Map();
  for (const road of roadWays) {
    for (const segment of road.segments) {
      const distance = pointToSegmentDistanceMeters(point, segment.start, segment.end);
      const candidate = {
        id: road.id,
        label: road.name || road.highway,
        highway: road.highway,
        distance_m: Math.round(distance),
        geometry: roadSnippet(road.path, segment.index, 7)
      };

      if (!nearest || distance < nearest.distance_m) {
        nearest = candidate;
      }

      if (distance <= 550) {
        const existing = nearbyByRoad.get(road.id);
        if (!existing || candidate.distance_m < existing.distance_m) {
          nearbyByRoad.set(road.id, candidate);
        }
      }
    }
  }
  return {
    nearestDistanceM: nearest?.distance_m ?? null,
    nearby: [...nearbyByRoad.values()]
      .sort((a, b) => a.distance_m - b.distance_m)
      .slice(0, 3)
  };
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

function walkMinutes(distanceM) {
  if (distanceM == null) return null;
  return Math.max(1, Math.ceil(distanceM / 80));
}

function cycleMinutes(distanceM) {
  if (distanceM == null) return null;
  return Math.max(1, Math.ceil(distanceM / 250));
}

function placeContext({ greenDistance, waterDistance, roadDistance, tourism500m, hiddenQuiet }) {
  if (waterDistance != null && waterDistance <= 350) return 'waterside';
  if (greenDistance != null && greenDistance <= 250) return 'park_edge';
  if ((roadDistance != null && roadDistance < 70) || tourism500m > 6) return 'civic_frontage';
  if (hiddenQuiet) return 'residential_retreat';
  return 'street_building';
}

function approachExperience({ greenDistance, waterDistance, roadDistance, tourism500m }) {
  if (waterDistance != null && waterDistance <= 350 && roadDistance != null && roadDistance > 100) {
    return {
      label: 'Waterside detour',
      note: 'Approach is likely to include quieter river or canal edges.'
    };
  }

  if (greenDistance != null && greenDistance <= 250 && roadDistance != null && roadDistance > 120) {
    return {
      label: 'Quiet backstreet approach',
      note: 'Approach is likely to pass through greener and less traffic-dominated streets.'
    };
  }

  if ((roadDistance != null && roadDistance < 70) || tourism500m > 6) {
    return {
      label: 'Busy urban arrival',
      note: 'Expect louder streets, busier crossings or tourism spillover near the site.'
    };
  }

  return {
    label: 'Mixed urban walk',
    note: 'Approach is broadly walkable but still shaped by ordinary urban street conditions.'
  };
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

  if (
    properties.hidden_core &&
    properties.category === 'literature' &&
    /Camden|Westminster|Islington|Southwark|Kensington|Chelsea|Hammersmith/i.test(borough)
  ) {
    routes.push('literary_lives_walk');
  }

  if (
    properties.hidden_core &&
    properties.water_feature_distance_m != null &&
    properties.water_feature_distance_m <= 350 &&
    properties.environment_score >= 3
  ) {
    routes.push('riverside_quiet_edge');
  }

  if (
    properties.hidden_quiet &&
    properties.green_space_distance_m != null &&
    properties.green_space_distance_m <= 250
  ) {
    routes.push('parkside_pause');
  }

  if (
    properties.hidden_core &&
    properties.station_access_via_lift &&
    properties.station_distance_m != null &&
    properties.station_distance_m <= 650
  ) {
    routes.push('step_free_starter');
  }

  if (
    properties.hidden_core &&
    properties.category === 'science' &&
    properties.station_distance_m != null &&
    properties.station_distance_m <= 700 &&
    /Camden|Westminster|Islington|Southwark|Kensington|Chelsea|Hammersmith|Wandsworth|Hackney/i.test(borough)
  ) {
    routes.push('science_invention_loop');
  }

  if (
    properties.hidden_core &&
    properties.category === 'politics_reform' &&
    properties.station_distance_m != null &&
    properties.station_distance_m <= 700 &&
    properties.osm_tourism_500m <= 2
  ) {
    routes.push('campaigns_and_reform');
  }

  if (
    properties.hidden_core &&
    properties.category === 'arts_music' &&
    properties.station_distance_m != null &&
    properties.station_distance_m <= 700 &&
    /Westminster|Kensington|Chelsea|Hammersmith|Camden|Islington|Lambeth|Wandsworth/i.test(borough)
  ) {
    routes.push('music_performance_circuit');
  }

  if (
    properties.hidden_core &&
    ['literature', 'science', 'exploration'].includes(properties.category) &&
    /Barnet|Harrow|Enfield|Redbridge|Waltham Forest|Croydon|Lewisham|Hounslow|Merton|Brent|Ealing|Sutton|Bromley|Greenwich|Richmond/i.test(borough)
  ) {
    routes.push('outer_london_pioneers');
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

  const waterQuery = `
[out:json][timeout:300];
(
  nwr["natural"="water"](${bboxText});
  nwr["waterway"~"river|canal|stream|ditch|riverbank"](${bboxText});
  nwr["landuse"="reservoir"](${bboxText});
  nwr["water"](${bboxText});
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

  const [tourismRaw, greenRaw, waterRaw, roadsRaw] = await Promise.all([
    fetchOverpass(tourismQuery, 'osm-tourism.json'),
    fetchOverpass(greenQuery, 'osm-green-spaces.json'),
    fetchOverpass(waterQuery, 'osm-water-features.json'),
    fetchOverpass(roadQuery, 'osm-major-roads.json')
  ]);

  const stations = normalizeTfLStations(tflRaw.stopPoints || [], bbox);
  const tourismPoints = normalizePointElements(tourismRaw.elements || [], tourismAllowed);
  const greenPoints = normalizePointElements(greenRaw.elements || [], () => true);
  const waterPoints = normalizePointElements(waterRaw.elements || [], () => true);
  const roadWays = normalizeRoadElements(roadsRaw.elements || []);

  const counts = {
    hiddenCore: 0,
    hiddenQuiet: 0,
    routes: Object.fromEntries(Object.keys(ROUTE_DEFS).map(key => [key, 0]))
  };
  const siteContext = {};

  const features = official.features.map(feature => {
    const nearest = nearestStation(feature, stations);
    const tourism = tourismMetrics(feature, tourismPoints);
    const green = nearestContextPoints(
      feature,
      greenPoints,
      1500,
      3,
      ['leisure', 'landuse', 'natural'],
      'Green space'
    );
    const water = nearestContextPoints(
      feature,
      waterPoints,
      1500,
      3,
      ['waterway', 'water', 'natural'],
      'Water feature'
    );
    const roads = nearestRoadContext(feature, roadWays);
    const greenDistance = green.nearestDistanceM;
    const waterDistance = water.nearestDistanceM;
    const roadDistance = roads.nearestDistanceM;
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
    const walkMins = walkMinutes(stationDistanceM);
    const cycleMins = cycleMinutes(stationDistanceM);
    const approach = approachExperience({
      greenDistance,
      waterDistance,
      roadDistance,
      tourism500m: tourism.tourism500m
    });
    const context = placeContext({
      greenDistance,
      waterDistance,
      roadDistance,
      tourism500m: tourism.tourism500m,
      hiddenQuiet
    });

    const props = {
      ...feature.properties,
      coordinates: feature.geometry.coordinates,
      category: feature.properties.category_group,
      type: 'historic_building',
      opening_status: 'always_visible',
      opening_info:
        'Blue plaque visible from the street. Building access varies and should be checked separately.',
      nearest_station: nearest?.station.name || null,
      nearest_station_lat: nearest?.station.lat ?? null,
      nearest_station_lon: nearest?.station.lon ?? null,
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
      water_feature_distance_m: waterDistance,
      major_road_distance_m: roadDistance,
      walk_minutes_from_station: walkMins,
      cycle_minutes_from_station: cycleMins,
      environment_score: envScore,
      place_context: context,
      approach_quality: approach.label,
      approach_note: approach.note,
      environment_tags: [
        greenDistance != null && greenDistance <= 400 ? 'near_green_space' : null,
        waterDistance != null && waterDistance <= 350 ? 'near_water' : null,
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

    siteContext[props.id] = {
      tourism: tourism.nearby,
      green: green.nearby,
      water: water.nearby,
      roads: roads.nearby
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

  await writeJson(OUTPUT_PATH, output);
  await writeJson(CONTEXT_OUTPUT_PATH, {
    created_at: new Date().toISOString(),
    features: siteContext
  });

  console.log(
    JSON.stringify(
      {
        output: OUTPUT_PATH,
        contextOutput: CONTEXT_OUTPUT_PATH,
        sourceCount: official.features.length,
        hiddenCore: counts.hiddenCore,
        hiddenQuiet: counts.hiddenQuiet,
        routeCounts: counts.routes,
        stations: stations.length,
        tourismPoints: tourismPoints.length,
        greenPoints: greenPoints.length,
        waterPoints: waterPoints.length,
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
