import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import HeritageMap from './components/HeritageMap.jsx';
import ExplorerPanels from './components/ExplorerPanels.jsx';

function matchesHiddenFilter(feature, hidden) {
  const props = feature.properties;
  if (hidden === 'quiet') return props.hidden_quiet;
  if (hidden === 'all') return true;
  return props.hidden_core;
}

export default function App() {
  const [dataset, setDataset] = useState({
    type: 'FeatureCollection',
    metadata: {},
    features: []
  });
  const [siteContext, setSiteContext] = useState({ features: {} });
  const [boundary, setBoundary] = useState(null);
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
    return dataset.features.filter(feature => {
      const props = feature.properties;
      const searchText = filters.search.trim().toLowerCase();
      if (!matchesHiddenFilter(feature, filters.hidden)) return false;
      if (filters.category !== 'all' && props.category !== filters.category) return false;
      if (filters.context !== 'all' && props.place_context !== filters.context) return false;
      if (filters.borough !== 'all' && props.borough !== filters.borough) return false;
      if (props.environment_score < filters.minEnv) return false;
      if (
        searchText &&
        ![
          props.name,
          props.professions_text,
          props.borough,
          props.official_category_text
        ]
          .filter(Boolean)
          .some(value => value.toLowerCase().includes(searchText))
      ) {
        return false;
      }
      return true;
    });
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
    return scopedFeatures.filter(feature => {
      if (filters.route === 'all') return true;
      return (feature.properties.routes || []).includes(filters.route);
    });
  }, [scopedFeatures, filters.route]);

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
        visibleCount={visible.length}
        routeTotal={Object.keys(dataset.metadata.routes || {}).length}
      />
      <div className="map-shell">
        <HeritageMap
          features={visible}
          route={filters.route}
          routeDefs={dataset.metadata.routes || {}}
          boundary={boundary}
          selectedFeature={selectedFeature}
          selectedSiteContext={selectedSiteContext}
          activeContextLayers={contextLayers}
          onFeatureSelect={handleFeatureSelect}
          onClearSelection={handleClearSelection}
          onMapReady={handleMapReady}
        />
        <ExplorerPanels
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          visibleFeatures={visible}
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
            <div className="range-legend">
              <strong>{selectedFeature.properties.name}</strong>
              <span>Dashed rings show approximate 10-minute and 20-minute walking catchments, about 800m and 1600m.</span>
              <span className="range-legend-note">Green and water are shown as OSM feature centroids linked back to the selected site.</span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
