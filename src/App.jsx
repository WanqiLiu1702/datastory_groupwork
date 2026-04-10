import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import HeritageMap from './components/HeritageMap.jsx';
import ExplorerPanels from './components/ExplorerPanels.jsx';
import ContextSummary from './components/ContextSummary.jsx';
import HeroLanding from './components/HeroLanding.jsx';
import CategoryMixPanel from './components/CategoryMixPanel.jsx';
import StoryContributionSection from './components/StoryContributionSection.jsx';
import AboutSection from './components/AboutSection.jsx';
import { CAT_LABELS, ROUTE_PERSONAS } from './constants.js';

function matchesHiddenFilter(feature, hidden) {
  const props = feature.properties;
  if (hidden === 'quiet') return props.hidden_quiet;
  if (hidden === 'all') return true;
  return props.hidden_core;
}

function matchesSearch(props, rawSearch) {
  const searchText = rawSearch.trim().toLowerCase();
  if (!searchText) return true;

  return [
    props.name,
    props.professions_text,
    props.borough,
    props.official_category_text
  ]
    .filter(Boolean)
    .some(value => value.toLowerCase().includes(searchText));
}

function matchesFilters(feature, filters, ignoredKeys = []) {
  const ignore = new Set(ignoredKeys);
  const props = feature.properties;
  const categoryFilter =
    filters.category === 'all'
      ? []
      : Array.isArray(filters.category)
        ? filters.category
        : [filters.category];

  if (!ignore.has('hidden') && !matchesHiddenFilter(feature, filters.hidden)) return false;
  if (!ignore.has('category') && categoryFilter.length && !categoryFilter.includes(props.category)) return false;
  if (!ignore.has('context') && filters.context !== 'all' && props.place_context !== filters.context) return false;
  if (!ignore.has('borough') && filters.borough !== 'all' && props.borough !== filters.borough) return false;
  if (!ignore.has('route') && filters.route !== 'all' && !(props.routes || []).includes(filters.route)) return false;
  if (!ignore.has('minEnv') && props.environment_score < filters.minEnv) return false;
  if (!ignore.has('search') && !matchesSearch(props, filters.search)) return false;

  return true;
}

function aggregateCounts(features, keyGetter) {
  const counts = new Map();

  for (const feature of features) {
    const key = keyGetter(feature);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => (b.count - a.count) || a.key.localeCompare(b.key));
}

function aggregateRouteStations(features) {
  const byStation = new Map();

  for (const feature of features) {
    const props = feature.properties;
    if (!props.nearest_station || props.nearest_station_lat == null || props.nearest_station_lon == null) continue;

    const current = byStation.get(props.nearest_station) || {
      name: props.nearest_station,
      lat: props.nearest_station_lat,
      lon: props.nearest_station_lon,
      count: 0,
      lines: new Set()
    };

    current.count += 1;
    for (const line of props.station_lines || []) {
      current.lines.add(line);
    }
    byStation.set(props.nearest_station, current);
  }

  return [...byStation.values()]
    .map(item => ({
      name: item.name,
      lat: item.lat,
      lon: item.lon,
      count: item.count,
      lines: [...item.lines]
    }))
    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name))
    .slice(0, 6);
}

function orderedFeatures(features) {
  if (features.length <= 2) return features;

  const pool = [...features];
  const ordered = [pool.shift()];

  while (pool.length) {
    const last = ordered.at(-1);
    const [lastLon, lastLat] = last.geometry.coordinates;
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    pool.forEach((candidate, index) => {
      const [lon, lat] = candidate.geometry.coordinates;
      const distance = (lat - lastLat) ** 2 + (lon - lastLon) ** 2;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    ordered.push(pool.splice(nearestIndex, 1)[0]);
  }

  return ordered;
}

function segmentCost(features) {
  if (features.length <= 1) return 0;

  let cost = 0;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (let index = 0; index < features.length; index += 1) {
    const [lon, lat] = features[index].geometry.coordinates;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);

    if (index > 0) {
      const [prevLon, prevLat] = features[index - 1].geometry.coordinates;
      cost += ((lat - prevLat) ** 2 + (lon - prevLon) ** 2) * 100000;
    }
  }

  const spreadPenalty = (maxLat - minLat) ** 2 + (maxLon - minLon) ** 2;
  return cost + spreadPenalty * 100000;
}

function pickRouteStops(features, limit) {
  if (features.length <= limit) return orderedFeatures(features);

  const ordered = orderedFeatures(features);
  let bestWindow = ordered.slice(0, limit);
  let bestCost = segmentCost(bestWindow);

  for (let start = 1; start <= ordered.length - limit; start += 1) {
    const window = ordered.slice(start, start + limit);
    const cost = segmentCost(window);
    if (cost < bestCost) {
      bestCost = cost;
      bestWindow = window;
    }
  }

  return bestWindow;
}

function buildRouteLegs(features) {
  if (!features || features.length < 2) return [];
  return features.slice(0, -1).map((from, index) => ({
    from,
    to: features[index + 1]
  }));
}

function isValidRouteCoordinate(value) {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    Math.abs(value[1]) <= 90 &&
    Math.abs(value[0]) <= 180
  );
}

function stepStreetName(step) {
  return step?.name || step?.ref || 'the next street';
}

function formatRouteInstruction(step) {
  const maneuver = step?.maneuver || {};
  const type = maneuver.type || 'continue';
  const modifier = maneuver.modifier;
  const street = stepStreetName(step);

  if (type === 'depart') return `Start on ${street}`;
  if (type === 'arrive') return 'Arrive at the next stop';
  if (type === 'roundabout') return street === 'the next street' ? 'Take the roundabout' : `Take the roundabout onto ${street}`;
  if (type === 'merge') return street === 'the next street' ? 'Merge ahead' : `Merge onto ${street}`;
  if (type === 'end of road') return street === 'the next street' ? 'At the end of the road continue ahead' : `At the end of the road continue onto ${street}`;

  if (modifier) {
    const action =
      modifier === 'straight'
        ? 'Continue'
        : modifier.charAt(0).toUpperCase() + modifier.slice(1);
    return street === 'the next street' ? action : `${action} onto ${street}`;
  }

  return street === 'the next street'
    ? type.charAt(0).toUpperCase() + type.slice(1)
    : `${type.charAt(0).toUpperCase() + type.slice(1)} on ${street}`;
}

function emptyContextLayers() {
  return {
    tourism: false,
    green: false,
    water: false,
    roads: false
  };
}

function normalizeBoroughName(name = '') {
  return name
    .replace(/^London Borough of /i, '')
    .replace(/^Royal Borough of /i, '')
    .replace(/^City of /i, '')
    .replace(/^City and County of the City of /i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export default function App() {
  const [dataset, setDataset] = useState({
    type: 'FeatureCollection',
    metadata: {},
    features: []
  });
  const [siteContext, setSiteContext] = useState({ features: {} });
  const [boundary, setBoundary] = useState(null);
  const [boroughBoundaries, setBoroughBoundaries] = useState(null);
  const [filters, setFilters] = useState({
    hidden: 'core',
    category: 'all',
    context: 'all',
    borough: 'all',
    route: 'all',
    minEnv: 1,
    search: ''
  });
  const [activePanel, setActivePanel] = useState(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [contextLayers, setContextLayers] = useState(emptyContextLayers);
  const [routeStopLimit, setRouteStopLimit] = useState(4);
  const [routeLegIndex, setRouteLegIndex] = useState(0);
  const [routeAudience, setRouteAudience] = useState(ROUTE_PERSONAS[0].id);
  const [experienceMode, setExperienceMode] = useState('places');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [routeDirections, setRouteDirections] = useState({
    status: 'idle',
    data: null,
    error: null
  });
  const mapApiRef = useRef(null);
  const explorerRef = useRef(null);
  const storiesRef = useRef(null);
  const aboutRef = useRef(null);

  const handleFeatureSelect = useCallback(id => {
    setSelectedFeatureId(id);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedFeatureId(null);
  }, []);

  const handleMapReady = useCallback(api => {
    mapApiRef.current = api;
  }, []);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'hidden-heritage-sites.geojson')
      .then(response => response.json())
      .then(setDataset)
      .catch(error => console.error('Failed to load hidden-heritage-sites.geojson', error));
  }, []);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'greater-london-boundary.json')
      .then(response => response.json())
      .then(data => {
        const item = Array.isArray(data) ? data[0] : data;
        if (!item?.geojson) return;
        setBoundary({
          type: 'Feature',
          properties: {
            name: item.display_name || item.name || 'Greater London boundary'
          },
          geometry: item.geojson
        });
      })
      .catch(error => console.error('Failed to load greater-london-boundary.json', error));
  }, []);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'site-context.json')
      .then(response => response.json())
      .then(setSiteContext)
      .catch(error => console.error('Failed to load site-context.json', error));
  }, []);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'london-boroughs.geojson')
      .then(response => response.json())
      .then(setBoroughBoundaries)
      .catch(error => console.error('Failed to load london-boroughs.geojson', error));
  }, []);

  const counts = useMemo(() => {
    const features = dataset.features || [];
    return {
      official: features.length,
      core: features.filter(feature => feature.properties.hidden_core).length,
      quiet: features.filter(feature => feature.properties.hidden_quiet).length
    };
  }, [dataset]);

  const boroughOptions = useMemo(() => {
    return [...new Set(dataset.features.map(feature => feature.properties.borough).filter(Boolean))].sort();
  }, [dataset]);

  const scopedFeatures = useMemo(() => {
    return dataset.features.filter(feature => matchesFilters(feature, filters, ['route']));
  }, [dataset, filters]);

  const routeCounts = useMemo(() => {
    const countsByRoute = {};
    for (const feature of scopedFeatures) {
      for (const route of feature.properties.routes || []) {
        countsByRoute[route] = (countsByRoute[route] || 0) + 1;
      }
    }
    return countsByRoute;
  }, [scopedFeatures]);

  const routePersonaCounts = useMemo(() => {
    const countsByPersona = Object.fromEntries(ROUTE_PERSONAS.map(persona => [persona.id, 0]));
    for (const route of Object.values(dataset.metadata.routes || {})) {
      for (const persona of route.recommended_for || []) {
        countsByPersona[persona] = (countsByPersona[persona] || 0) + 1;
      }
    }
    return countsByPersona;
  }, [dataset.metadata.routes]);

  const visible = useMemo(() => {
    const filtered = dataset.features.filter(feature => matchesFilters(feature, filters));
    if (filters.route === 'all') return filtered;
    return pickRouteStops(filtered, routeStopLimit);
  }, [dataset, filters, routeStopLimit]);

  const boroughRanking = useMemo(() => {
    return aggregateCounts(
      dataset.features.filter(feature => matchesFilters(feature, filters, ['borough'])),
      feature => feature.properties.borough
    );
  }, [dataset, filters]);

  const categoryRanking = useMemo(() => {
    return aggregateCounts(
      dataset.features.filter(feature => matchesFilters(feature, filters, ['category'])),
      feature => feature.properties.category
    );
  }, [dataset, filters]);

  const categoryComposition = useMemo(() => {
    const countsByCategory = new Map();
    for (const feature of visible) {
      const key = feature.properties.category;
      countsByCategory.set(key, (countsByCategory.get(key) || 0) + 1);
    }

    return Object.keys(CAT_LABELS).map(key => ({
      key,
      count: countsByCategory.get(key) || 0
    }));
  }, [visible]);

  const routeStationMarkers = useMemo(() => {
    if (filters.route === 'all') return [];
    return aggregateRouteStations(visible);
  }, [filters.route, visible]);

  const routeLegs = useMemo(() => {
    if (filters.route === 'all') return [];
    return buildRouteLegs(visible);
  }, [filters.route, visible]);

  const activeRouteLeg = useMemo(() => {
    if (!routeLegs.length) return null;
    return routeLegs[Math.min(routeLegIndex, routeLegs.length - 1)] || null;
  }, [routeLegIndex, routeLegs]);

  const selectedFeature = useMemo(() => {
    return dataset.features.find(feature => feature.properties.id === selectedFeatureId) || null;
  }, [dataset.features, selectedFeatureId]);

  const selectedSiteContext = useMemo(() => {
    if (!selectedFeatureId) return null;
    return siteContext.features?.[selectedFeatureId] || null;
  }, [selectedFeatureId, siteContext.features]);

  useEffect(() => {
    if (!selectedFeatureId) return;
    const stillVisible = visible.some(feature => feature.properties.id === selectedFeatureId);
    if (!stillVisible) {
      setSelectedFeatureId(null);
    }
  }, [selectedFeatureId, visible]);

  useEffect(() => {
    setRouteLegIndex(0);
  }, [filters.route, routeStopLimit]);

  useEffect(() => {
    if (!routeLegs.length) {
      setRouteLegIndex(0);
      return;
    }
    if (routeLegIndex > routeLegs.length - 1) {
      setRouteLegIndex(routeLegs.length - 1);
    }
  }, [routeLegIndex, routeLegs]);

  useEffect(() => {
    if (filters.route === 'all' || visible.length < 2) {
      setRouteDirections({
        status: 'idle',
        data: null,
        error: null
      });
      return;
    }

    const controller = new AbortController();
    const coordinates = visible
      .map(feature => feature.geometry.coordinates)
      .filter(isValidRouteCoordinate)
      .map(([lon, lat]) => `${lon},${lat}`)
      .join(';');

    if (!coordinates) {
      setRouteDirections({
        status: 'error',
        data: null,
        error: 'No valid route coordinates'
      });
      return;
    }

    const url = `https://router.project-osrm.org/route/v1/foot/${coordinates}?overview=full&geometries=geojson&steps=true`;

    setRouteDirections({
      status: 'loading',
      data: null,
      error: null
    });

    fetch(url, { signal: controller.signal })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Routing request failed with ${response.status}`);
        }
        return response.json();
      })
      .then(payload => {
        const route = payload?.routes?.[0];
        if (!route?.geometry?.coordinates?.length || !route?.legs?.length) {
          throw new Error('No route geometry returned');
        }

        const safeCoordinates = route.geometry.coordinates
          .filter(isValidRouteCoordinate)
          .map(([lon, lat]) => [lat, lon]);

        if (safeCoordinates.length < 2) {
          throw new Error('Returned route geometry was invalid');
        }

        const legs = route.legs.map(leg => ({
          distanceM: Math.round(leg.distance || 0),
          durationMin: Math.max(1, Math.round((leg.duration || 0) / 60)),
          steps: (leg.steps || [])
            .filter(step => step?.maneuver?.type !== 'arrive')
            .map(step => ({
              instruction: formatRouteInstruction(step),
              street: stepStreetName(step),
              type: step?.maneuver?.type || 'continue',
              modifier: step?.maneuver?.modifier || null,
              distanceM: Math.max(1, Math.round(step.distance || 0)),
              durationMin: Math.max(1, Math.round((step.duration || 0) / 60))
            }))
        }));

        setRouteDirections({
          status: 'ready',
          data: {
            coordinates: safeCoordinates,
            totalDistanceM: Math.round(route.distance || 0),
            totalDurationMin: Math.max(1, Math.round((route.duration || 0) / 60)),
            legs
          },
          error: null
        });
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setRouteDirections({
          status: 'error',
          data: null,
          error: error.message || 'Routing unavailable'
        });
      });

    return () => controller.abort();
  }, [filters.route, visible]);

  const heroFeatures = useMemo(() => {
    const coreHidden = dataset.features.filter(feature => feature.properties.hidden_core);
    if (coreHidden.length) return coreHidden;
    return dataset.features.slice(0, 120);
  }, [dataset.features]);

  const scrollToExplorer = useCallback(() => {
    explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToStories = useCallback(() => {
    storiesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToAbout = useCallback(() => {
    aboutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const openPlacesExplorer = useCallback(() => {
    setExperienceMode('places');
    setSidebarOpen(true);
    setSelectedFeatureId(null);
    setContextLayers(emptyContextLayers());
    setFilters(current => ({ ...current, route: 'all' }));
    setActivePanel(null);
    scrollToExplorer();
    window.setTimeout(() => {
      mapApiRef.current?.fitVisible?.();
    }, 260);
  }, [scrollToExplorer]);

  const openRouteGuide = useCallback((personaId = null) => {
    setExperienceMode('routes');
    setSidebarOpen(false);
    let preferredRoute = 'all';
    if (personaId) {
      preferredRoute =
        Object.entries(dataset.metadata.routes || {}).find(([, route]) =>
          (route.recommended_for || []).includes(personaId)
        )?.[0] || 'all';
    }
    if (personaId) {
      setRouteAudience(personaId);
    }
    setSelectedFeatureId(null);
    setContextLayers(emptyContextLayers());
    if (personaId) {
      setFilters(current => ({ ...current, route: preferredRoute }));
    }
    setActivePanel('routes');
    scrollToExplorer();
    window.setTimeout(() => {
      mapApiRef.current?.fitVisible?.();
    }, 260);
  }, [dataset.metadata.routes, scrollToExplorer]);

  return (
    <div className="page-shell">
      <HeroLanding
        boundary={boundary}
        heroFeatures={heroFeatures}
        counts={counts}
        routeDefs={dataset.metadata.routes || {}}
        routeAudience={routeAudience}
        routePersonaCounts={routePersonaCounts}
        onChoosePersona={setRouteAudience}
        onExploreMap={scrollToExplorer}
        onOpenPlaces={openPlacesExplorer}
        onOpenRoutes={openRouteGuide}
        onOpenStories={scrollToStories}
        onOpenAbout={scrollToAbout}
      />

      <section ref={explorerRef} className="explorer-section">
        <div
          className={
            'app' +
            (experienceMode === 'routes' ? ' app-route-focus' : '') +
            (experienceMode === 'places' && !sidebarOpen ? ' app-sidebar-collapsed' : '')
          }
        >
          <CategoryMixPanel items={categoryComposition} total={visible.length} />
          <Sidebar
            counts={counts}
            filters={filters}
            setFilters={setFilters}
            boroughOptions={boroughOptions}
            boroughRanking={boroughRanking}
            categoryRanking={categoryRanking}
            sidebarOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onOpenPlaces={openPlacesExplorer}
            onOpenRoutes={openRouteGuide}
          />
          <div className="map-shell">
            <HeritageMap
              features={visible}
              route={filters.route}
              routeDefs={dataset.metadata.routes || {}}
              routeLeg={activeRouteLeg}
              routeDirections={routeDirections.data}
              boundary={boundary}
              boroughBoundaries={boroughBoundaries}
              activeBorough={normalizeBoroughName(filters.borough)}
              routeStationMarkers={routeStationMarkers}
              selectedFeature={selectedFeature}
              selectedSiteContext={selectedSiteContext}
              siteContextById={siteContext.features || {}}
              activeContextLayers={contextLayers}
              onFeatureSelect={handleFeatureSelect}
              onClearSelection={handleClearSelection}
              onMapReady={handleMapReady}
            />
            <ExplorerPanels
              activePanel={activePanel}
              setActivePanel={setActivePanel}
              experienceMode={experienceMode}
              visibleFeatures={visible}
              routeSourceFeatures={scopedFeatures}
              routeDefs={dataset.metadata.routes || {}}
              routeCounts={routeCounts}
              activeRoute={filters.route}
              routeStopLimit={routeStopLimit}
              setRouteStopLimit={setRouteStopLimit}
              routeLegIndex={routeLegIndex}
              setRouteLegIndex={setRouteLegIndex}
              routeAudience={routeAudience}
              setRouteAudience={setRouteAudience}
              routeDirections={routeDirections}
              onActivatePlacesMode={() => setExperienceMode('places')}
              onActivateRouteMode={() => setExperienceMode('routes')}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={() => {
                setExperienceMode('places');
                setSidebarOpen(current => !current);
              }}
              onSetRoute={value => {
                setSelectedFeatureId(null);
                setContextLayers(emptyContextLayers());
                setFilters(current => ({ ...current, route: value }));
              }}
              onSelectFeature={id => {
                setSelectedFeatureId(id);
                mapApiRef.current && mapApiRef.current.focusFeature(id);
              }}
            />
            {selectedFeature ? (
              <>
                <div className="context-toolbar">
                  <div className="floating-toolbar-label">Context Layers</div>
                  <button
                    type="button"
                    className="context-toggle context-toggle-master"
                    onClick={() =>
                      setContextLayers(current => {
                        const shouldEnableAll = !Object.values(current).every(Boolean);
                        return {
                          tourism: shouldEnableAll,
                          green: shouldEnableAll,
                          water: shouldEnableAll,
                          roads: shouldEnableAll
                        };
                      })
                    }
                  >
                    {Object.values(contextLayers).every(Boolean) ? 'Hide all' : 'Show all'}
                  </button>
                  {[
                    ['tourism', 'OSM tourism'],
                    ['green', 'Green space'],
                    ['water', 'Water'],
                    ['roads', 'Major roads']
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={'context-toggle' + (contextLayers[key] ? ' active' : '')}
                      onClick={() => setContextLayers(current => ({ ...current, [key]: !current[key] }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <ContextSummary
                  selectedFeature={selectedFeature}
                  selectedSiteContext={selectedSiteContext}
                  activeContextLayers={contextLayers}
                />
                <div className="range-legend">
                  <strong>{selectedFeature.properties.name}</strong>
                  <span>10 and 20 minute dashed rings show approximate walking catchments.</span>
                  <span className="range-legend-note">Context buttons reveal nearby tourism, green, water and major-road cues.</span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section ref={storiesRef}>
        <StoryContributionSection
          boundary={boundary}
          onOpenPlaces={openPlacesExplorer}
          onOpenRoutes={openRouteGuide}
        />
      </section>

      <section ref={aboutRef}>
        <AboutSection counts={counts} routeCount={Object.keys(dataset.metadata.routes || {}).length} />
      </section>
    </div>
  );
}
