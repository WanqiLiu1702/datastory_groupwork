import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const BASE_URL = 'https://www.english-heritage.org.uk';
const SEARCH_URL =
  `${BASE_URL}/api/BluePlaqueSearch/GetMatchingBluePlaques?pageBP=1&sizeBP=2000&borBP=0&keyBP=&catBP=`;
const OUTPUT_PATH = path.join(process.cwd(), 'public', 'english-heritage-blue-plaques.geojson');
const CONCURRENCY = 8;
const LIMIT = Number.parseInt(process.env.LIMIT || '0', 10) || 0;
const COORDINATE_FALLBACKS = {
  '118062': {
    lat: 51.4604915,
    lon: -0.2288818,
    source: 'OpenStreetMap Nominatim fallback for missing official page coordinates'
  }
};

function decodeHtml(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(urlPath = '') {
  return new URL(urlPath, BASE_URL).toString();
}

function matchOne(html, pattern) {
  const match = html.match(pattern);
  return match ? decodeHtml(match[1]) : null;
}

function deriveGroup(categories = [], professions = '') {
  const lookup = new Set(categories.map(item => item.toLowerCase()));
  const text = `${categories.join(' ')} ${professions}`.toLowerCase();

  if (
    lookup.has('literature') ||
    lookup.has('journalism and publishing') ||
    lookup.has('philosophy') ||
    text.includes('poet') ||
    text.includes('novelist') ||
    text.includes('writer')
  ) {
    return 'literature';
  }

  if (
    lookup.has('science') ||
    lookup.has('medicine') ||
    lookup.has('engineering and transport') ||
    lookup.has('industry and invention') ||
    lookup.has('economics and statistics') ||
    lookup.has('archaeology and ethnography') ||
    text.includes('scientist') ||
    text.includes('physicist') ||
    text.includes('engineer')
  ) {
    return 'science';
  }

  if (
    lookup.has('fine arts') ||
    lookup.has('music and dance') ||
    lookup.has('music hall and radio comedy') ||
    lookup.has('theatre and film') ||
    lookup.has('radio and television') ||
    lookup.has('cartoons and illustration') ||
    lookup.has('applied arts') ||
    text.includes('artist') ||
    text.includes('actor') ||
    text.includes('musician')
  ) {
    return 'arts_music';
  }

  if (
    lookup.has('travel and exploration') ||
    lookup.has('aviation') ||
    lookup.has('cartography') ||
    lookup.has('overseas visitors')
  ) {
    return 'exploration';
  }

  if (
    lookup.has('architecture and building') ||
    lookup.has('historical sites') ||
    lookup.has('gardening') ||
    text.includes('architect') ||
    text.includes('landscape')
  ) {
    return 'architecture';
  }

  return 'politics_reform';
}

function extractDetailFields(html) {
  const intro = html.match(
    /Plaque erected in\s*<b>(.*?)<\/b>\s*by\s*<b>(.*?)<\/b>\s*at\s*<b>(.*?)<\/b>/is
  );
  const coords = html.match(
    /GetMapAndData\("blueplaquepage",\s*\d+,\s*\d+,\s*\d+,\s*".*?",\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,/is
  );
  const categoriesText = matchOne(
    html,
    /<p class="column large-category[\s\S]*?>([\s\S]*?)<\/p>/i
  );
  const inscription = matchOne(
    html,
    /<p class="medium-offset-1 column small-title[\s\S]*?>Inscription<\/p>\s*<p class="column small-detail[\s\S]*?>([\s\S]*?)<\/p>/i
  );
  const material = matchOne(
    html,
    /<p class="medium-offset-1 column small-title[\s\S]*?>Material<\/p>\s*<p class="column small-detail[\s\S]*?>([\s\S]*?)<\/p>/i
  );

  const officialCategories = categoriesText
    ? categoriesText
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    : [];

  return {
    erectedYear: intro ? decodeHtml(intro[1]) : null,
    erectedBy: intro ? decodeHtml(intro[2]) : null,
    introAddress: intro ? decodeHtml(intro[3]) : null,
    lat: coords ? Number(coords[1]) : null,
    lon: coords ? Number(coords[2]) : null,
    officialCategories,
    inscription,
    material
  };
}

function buildFeature(item, detail) {
  const address = detail.introAddress || item.address || '';
  const borough = address.split(',').map(part => part.trim()).filter(Boolean).pop() || null;
  const professions = (item.professions || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [detail.lon, detail.lat]
    },
    properties: {
      id: String(item.id),
      name: decodeHtml(item.title),
      address,
      borough,
      summary: decodeHtml(item.summary || ''),
      professions,
      professions_text: decodeHtml(item.professions || ''),
      official_categories: detail.officialCategories,
      official_category_text: detail.officialCategories.join(', '),
      category_group: deriveGroup(detail.officialCategories, item.professions || ''),
      year_erected: detail.erectedYear ? Number.parseInt(detail.erectedYear, 10) || null : null,
      erected_by: detail.erectedBy,
      inscription: detail.inscription,
      material: detail.material,
      path: absoluteUrl(item.path),
      image_url: absoluteUrl(item.imagePath),
      coordinate_source: detail.coordinateSource || 'English Heritage detail page map payload',
      source: 'English Heritage Blue Plaques'
    }
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
  }
  return response.text();
}

async function withRetry(task, label, attempt = 1) {
  try {
    return await task();
  } catch (error) {
    if (attempt >= 3) {
      throw new Error(`${label} failed after ${attempt} attempts: ${error.message}`);
    }
    const delayMs = 500 * attempt;
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return withRetry(task, label, attempt + 1);
  }
}

async function main() {
  const listing = await withRetry(() => fetchJson(SEARCH_URL), 'listing request');
  const items = LIMIT > 0 ? (listing.plaques || []).slice(0, LIMIT) : listing.plaques || [];
  const failures = [];

  if (!items.length) {
    throw new Error('No plaques returned from the English Heritage API.');
  }

  const features = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      try {
        const html = await withRetry(
          () => fetchText(absoluteUrl(item.path)),
          `detail page ${item.path}`
        );
        const detail = extractDetailFields(html);
        const fallback = COORDINATE_FALLBACKS[String(item.id)];

        if ((detail.lat == null || detail.lon == null) && fallback) {
          detail.lat = fallback.lat;
          detail.lon = fallback.lon;
          detail.coordinateSource = fallback.source;
        }

        if (detail.lat == null || detail.lon == null) {
          throw new Error(`Missing coordinates for ${item.path}`);
        }

        features[index] = buildFeature(item, detail);
      } catch (error) {
        failures.push({
          id: item.id,
          path: absoluteUrl(item.path),
          error: error.message
        });
        console.error(`Failed ${index + 1}/${items.length}: ${item.path}`);
      }

      if ((index + 1) % 50 === 0 || index === items.length - 1) {
        console.log(`Processed ${index + 1}/${items.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      title: 'English Heritage Blue Plaques',
      source: absoluteUrl('/visit/blue-plaques/'),
      fetched_at: new Date().toISOString(),
      total: listing.total,
      fetched_count: features.filter(Boolean).length,
      failed_count: failures.length,
      note:
        'Official English Heritage catalogue with coordinates and detail-page metadata. Hidden-heritage scoring and quietness tags should be added as a separate project layer, not treated as official fields.'
    },
    failures,
    features: features.filter(Boolean)
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(geojson, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${geojson.features.length} features to ${OUTPUT_PATH}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
