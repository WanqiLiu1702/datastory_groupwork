import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import HeritageMap from './components/HeritageMap.jsx';
import ExplorerPanels from './components/ExplorerPanels.jsx';
import ContextSummary from './components/ContextSummary.jsx';

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
  const [activePanel, setActivePanel] = useState('results');
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [contextLayers, setContextLayers] = useState({
    tourism: false,
    green: false,
    water: false,
    roads: false
  });
  const mapApiRef = useRef(null);

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

  const visible = useMemo(() => {
    return dataset.features.filter(feature => matchesFilters(feature, filters));
  }, [dataset, filters]);

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

  return (
    <div className="app">
      <Sidebar
        counts={counts}
        filters={filters}
        setFilters={setFilters}
        boroughOptions={boroughOptions}
        boroughRanking={boroughRanking}
        categoryRanking={categoryRanking}
      />
      <div className="map-shell">
        <HeritageMap
          features={visible}
          route={filters.route}
          routeDefs={dataset.metadata.routes || {}}
          boundary={boundary}
          boroughBoundaries={boroughBoundaries}
          activeBorough={normalizeBoroughName(filters.borough)}
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
          visibleFeatures={visible}
          routeSourceFeatures={scopedFeatures}
          routeDefs={dataset.metadata.routes || {}}
          routeCounts={routeCounts}
          activeRoute={filters.route}
          onSetRoute={value => setFilters(current => ({ ...current, route: value }))}
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
  );
}
