import React, { useMemo } from 'react';
import ResultList from './ResultList.jsx';

export default function ExplorerPanels({
  activePanel,
  setActivePanel,
  visibleFeatures,
  routeDefs,
  routeCounts,
  activeRoute,
  onSetRoute,
  onSelectFeature
}) {
  const routeEntries = Object.entries(routeDefs);
  const availableRouteCount = useMemo(() => {
    return Object.keys(routeCounts).length || routeEntries.length;
  }, [routeCounts, routeEntries.length]);

  const togglePanel = panel => {
    setActivePanel(current => (current === panel ? null : panel));
  };

  const selectRoute = routeKey => {
    onSetRoute(routeKey);
    setActivePanel('results');
  };

  return (
    <>
      <div className="map-toolbar">
        <div className="floating-toolbar-label">Explore</div>
        <button
          type="button"
          className={'map-toolbar-button' + (activePanel === 'results' ? ' active' : '')}
          onClick={() => togglePanel('results')}
        >
          Places list
          <span>{visibleFeatures.length}</span>
        </button>
        <button
          type="button"
          className={'map-toolbar-button' + (activePanel === 'routes' ? ' active' : '')}
          onClick={() => togglePanel('routes')}
        >
          Curated routes
          <span>{availableRouteCount}</span>
        </button>
      </div>

      <div className={'overlay-panel' + (activePanel ? ' is-open' : '')}>
        {activePanel ? (
          <>
            <div className="overlay-panel-header">
              <div>
                <div className="overlay-eyebrow">{activePanel === 'results' ? 'Places Drawer' : 'Routes Drawer'}</div>
                <h2>{activePanel === 'results' ? `${visibleFeatures.length} places match` : 'Curated Routes'}</h2>
                <p>
                  {activePanel === 'results'
                    ? activeRoute !== 'all' && routeDefs[activeRoute]
                      ? `Now showing the ${routeDefs[activeRoute].label} route.`
                      : 'Filtered hidden-heritage places.'
                    : 'Choose a route to turn the map into a guided walk.'}
                </p>
              </div>
              <button type="button" className="overlay-close" onClick={() => setActivePanel(null)}>
                Close
              </button>
            </div>

            <div className="overlay-panel-body">
              {activePanel === 'results' ? (
                <ResultList features={visibleFeatures} onSelect={onSelectFeature} showCount={false} />
              ) : (
                <div className="route-panel-grid">
                  <div
                    className={'route route-card-large' + (activeRoute === 'all' ? ' active' : '')}
                    onClick={() => selectRoute('all')}
                  >
                    <div className="route-head">
                      <div className="route-swatch route-swatch-neutral" />
                      <div className="route-name">All visible places</div>
                      <div className="route-count">{visibleFeatures.length}</div>
                    </div>
                    <div className="route-desc">Clear the route filter and go back to the full filtered map.</div>
                    <div className="route-meta">
                      <span>Free exploration</span>
                      <span>Current filter scope</span>
                    </div>
                  </div>

                  {routeEntries.map(([key, route]) => (
                    <div
                      key={key}
                      className={'route route-card-large' + (activeRoute === key ? ' active' : '')}
                      onClick={() => selectRoute(key)}
                    >
                      <div className="route-head">
                        <div className="route-swatch" style={{ background: route.color }} />
                        <div className="route-name">{route.label}</div>
                        <div className="route-count">{routeCounts[key] || 0}</div>
                      </div>
                      <div className="route-desc">{route.description}</div>
                      <div className="route-meta">
                        <span>{route.duration}</span>
                        <span>{route.focus}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
