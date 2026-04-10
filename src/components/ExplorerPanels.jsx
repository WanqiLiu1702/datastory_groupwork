import React, { useMemo } from 'react';
import ResultList from './ResultList.jsx';
import { CAT_LABELS, ROUTE_COLORS } from '../constants.js';

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

function topCounts(items, accessor, limit = 3) {
  const counts = new Map();
  for (const item of items) {
    const key = accessor(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export default function ExplorerPanels({
  activePanel,
  setActivePanel,
  visibleFeatures,
  routeSourceFeatures,
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

  const routeDetails = useMemo(() => {
    return Object.fromEntries(
      routeEntries.map(([key, route]) => {
        const features = routeSourceFeatures.filter(feature => (feature.properties.routes || []).includes(key));
        const ordered = orderedFeatures(features);
        const walkValues = features
          .map(feature => feature.properties.walk_minutes_from_station)
          .filter(value => Number.isFinite(value));
        const avgWalk = walkValues.length
          ? Math.round(walkValues.reduce((sum, value) => sum + value, 0) / walkValues.length)
          : null;

        return [
          key,
          {
            ...route,
            count: features.length,
            quietCount: features.filter(feature => feature.properties.hidden_quiet).length,
            boroughs: topCounts(features, feature => feature.properties.borough),
            themes: topCounts(features, feature => CAT_LABELS[feature.properties.category] || feature.properties.category),
            avgWalk,
            stops: ordered.slice(0, 6).map(feature => ({
              id: feature.properties.id,
              name: feature.properties.name,
              borough: feature.properties.borough,
              quiet: feature.properties.hidden_quiet,
              walk: feature.properties.walk_minutes_from_station
            }))
          }
        ];
      })
    );
  }, [routeEntries, routeSourceFeatures]);

  const togglePanel = panel => {
    setActivePanel(current => (current === panel ? null : panel));
  };

  const selectRoute = routeKey => {
    onSetRoute(routeKey);
    setActivePanel('routes');
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
                        <div className="route-swatch" style={{ background: ROUTE_COLORS[key] || route.color }} />
                        <div className="route-name">{route.label}</div>
                        <div className="route-count">{routeCounts[key] || 0}</div>
                      </div>
                      <div className="route-desc">{route.description}</div>
                      <div className="route-meta">
                        <span>{route.duration}</span>
                        <span>{route.focus}</span>
                        {routeDetails[key]?.quietCount ? <span>{routeDetails[key].quietCount} quiet hidden</span> : null}
                        {routeDetails[key]?.boroughs?.length ? <span>{routeDetails[key].boroughs.length} boroughs</span> : null}
                      </div>
                    </div>
                  ))}

                  {activeRoute !== 'all' && routeDetails[activeRoute] ? (
                    <div className="route-detail-card">
                      <div className="route-detail-head">
                        <div className="route-detail-kicker">Selected Route</div>
                        <h3>{routeDetails[activeRoute].label}</h3>
                        <p>{routeDetails[activeRoute].description}</p>
                      </div>

                      <div className="route-detail-stats">
                        <div className="route-detail-stat">
                          <strong>{routeDetails[activeRoute].count}</strong>
                          <span>stops</span>
                        </div>
                        <div className="route-detail-stat">
                          <strong>{routeDetails[activeRoute].quietCount}</strong>
                          <span>quiet hidden</span>
                        </div>
                        <div className="route-detail-stat">
                          <strong>{routeDetails[activeRoute].boroughs.length}</strong>
                          <span>boroughs</span>
                        </div>
                        <div className="route-detail-stat">
                          <strong>{routeDetails[activeRoute].avgWalk ?? 'n/a'}</strong>
                          <span>{routeDetails[activeRoute].avgWalk == null ? 'walk' : 'min walk avg'}</span>
                        </div>
                      </div>

                      <div className="route-detail-section">
                        <div className="route-detail-label">Borough coverage</div>
                        <div className="badge-wrap">
                          {routeDetails[activeRoute].boroughs.map(item => (
                            <span key={item.label} className="badge">
                              {item.label} {item.count}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="route-detail-section">
                        <div className="route-detail-label">Theme mix</div>
                        <div className="badge-wrap">
                          {routeDetails[activeRoute].themes.map(item => (
                            <span key={item.label} className="badge">
                              {item.label} {item.count}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="route-detail-section">
                        <div className="route-detail-label">Preview stops</div>
                        <div className="route-stop-list">
                          {routeDetails[activeRoute].stops.map((stop, index) => (
                            <button
                              key={stop.id}
                              type="button"
                              className="route-stop"
                              onClick={() => onSelectFeature(stop.id)}
                            >
                              <span className="route-stop-index">{index + 1}</span>
                              <span className="route-stop-copy">
                                <strong>{stop.name}</strong>
                                <span>
                                  {stop.borough}
                                  {Number.isFinite(stop.walk) ? ` · ${stop.walk} min walk from TfL` : ''}
                                  {stop.quiet ? ' · quiet hidden' : ''}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
