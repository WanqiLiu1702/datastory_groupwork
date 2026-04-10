import React, { useEffect, useMemo, useState } from 'react';
import ResultList from './ResultList.jsx';
import { CAT_LABELS, ROUTE_COLORS } from '../constants.js';

const PERSONAS = [
  {
    id: 'Quiet Cultural Seeker',
    title: 'Quiet Cultural Seeker',
    description: 'Looks for calm, reflective and inspiring heritage spaces away from crowded tourist areas.'
  },
  {
    id: 'Experienced London Visitor',
    title: 'Experienced London Visitor',
    description: 'Has already seen major landmarks and wants deeper, less-promoted cultural places.'
  },
  {
    id: 'Community Heritage Advocate',
    title: 'Community Heritage Advocate',
    description: 'Wants to surface culturally valuable but under-recognised places in local heritage discussions.'
  }
];

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

function topArrayCounts(items, accessor, limit = 5) {
  const counts = new Map();
  for (const item of items) {
    const values = accessor(item) || [];
    for (const value of values) {
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function pickRouteStops(features, limit) {
  if (features.length <= limit) return orderedFeatures(features);

  const ordered = orderedFeatures(features);
  let bestWindow = ordered.slice(0, limit);
  let bestCost = Infinity;

  for (let start = 0; start <= ordered.length - limit; start += 1) {
    const window = ordered.slice(start, start + limit);
    let cost = 0;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;

    for (let index = 0; index < window.length; index += 1) {
      const [lon, lat] = window[index].geometry.coordinates;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);

      if (index > 0) {
        const [prevLon, prevLat] = window[index - 1].geometry.coordinates;
        cost += ((lat - prevLat) ** 2 + (lon - prevLon) ** 2) * 100000;
      }
    }

    cost += (((maxLat - minLat) ** 2 + (maxLon - minLon) ** 2) * 100000);

    if (cost < bestCost) {
      bestCost = cost;
      bestWindow = window;
    }
  }

  return bestWindow;
}

export default function ExplorerPanels({
  activePanel,
  setActivePanel,
  visibleFeatures,
  routeSourceFeatures,
  routeDefs,
  routeCounts,
  activeRoute,
  routeStopLimit,
  setRouteStopLimit,
  routeLegIndex,
  setRouteLegIndex,
  routeDirections,
  onSetRoute,
  onSelectFeature
}) {
  const [routeAudience, setRouteAudience] = useState(PERSONAS[0].id);
  const routeState = routeDirections || {
    status: 'idle',
    data: null,
    error: null
  };
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
            stations: topCounts(features, feature => feature.properties.nearest_station, 4),
            lines: topArrayCounts(features, feature => feature.properties.station_lines, 5),
            avgWalk,
            stops: pickRouteStops(ordered, routeStopLimit).map(feature => ({
              id: feature.properties.id,
              name: feature.properties.name,
              borough: feature.properties.borough,
              quiet: feature.properties.hidden_quiet,
              walk: feature.properties.walk_minutes_from_station,
              station: feature.properties.nearest_station
            }))
          }
        ];
      })
    );
  }, [routeEntries, routeSourceFeatures, routeStopLimit]);

  useEffect(() => {
    if (activeRoute === 'all' || !routeDefs[activeRoute]?.recommended_for?.length) return;
    setRouteAudience(routeDefs[activeRoute].recommended_for[0]);
  }, [activeRoute, routeDefs]);

  const togglePanel = panel => {
    setActivePanel(current => (current === panel ? null : panel));
  };

  const selectRoute = routeKey => {
    onSetRoute(routeKey);
    setActivePanel('routes');
    setRouteLegIndex(0);
    if (routeKey !== 'all' && routeDefs[routeKey]?.recommended_for?.length) {
      setRouteAudience(routeDefs[routeKey].recommended_for[0]);
    }
  };

  const filteredRouteEntries = useMemo(() => {
    return routeEntries.filter(([, route]) => (route.recommended_for || []).includes(routeAudience));
  }, [routeAudience, routeEntries]);

  const currentRoute =
    activeRoute !== 'all' && routeDefs[activeRoute]?.recommended_for?.includes(routeAudience)
      ? routeDetails[activeRoute]
      : null;
  const currentLegs =
    currentRoute?.stops?.length > 1
      ? currentRoute.stops.slice(0, -1).map((from, index) => ({
          from,
          to: currentRoute.stops[index + 1]
        }))
      : [];
  const currentLeg = currentLegs[Math.min(routeLegIndex, Math.max(currentLegs.length - 1, 0))] || null;
  const currentPersona = PERSONAS.find(persona => persona.id === routeAudience) || PERSONAS[0];

  const jumpToLeg = nextIndex => {
    if (!currentLegs.length) return;
    const clamped = Math.max(0, Math.min(nextIndex, currentLegs.length - 1));
    setRouteLegIndex(clamped);
  };

  const currentLegDirections = routeState.data?.legs?.[Math.min(routeLegIndex, Math.max((routeState.data?.legs?.length || 1) - 1, 0))] || null;
  const streetStepList = currentLegDirections?.steps?.slice(0, 6) || [];
  const routeHeadline =
    routeState.status === 'ready'
      ? `${currentLegDirections?.durationMin ?? routeState.data.totalDurationMin} min walk · ${currentLegDirections?.distanceM ?? routeState.data.totalDistanceM}m`
      : routeState.status === 'loading'
        ? 'Finding street-level walking route…'
        : routeState.status === 'error'
          ? 'Street routing unavailable right now. Showing a direct preview line.'
          : 'Select a route leg to preview the walking path.';

  const jumpToStop = index => {
    if (!currentRoute?.stops?.length) return;
    const clamped = Math.max(0, Math.min(index, currentRoute.stops.length - 1));
    onSelectFeature(currentRoute.stops[clamped].id);
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
          Route guide
          <span>{availableRouteCount}</span>
        </button>
      </div>

      <div className={'overlay-panel' + (activePanel ? ' is-open' : '') + (activePanel === 'routes' ? ' route-panel-open' : '')}>
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
                    : 'Choose a route to turn the map into a guided walk with street-level pathing.'}
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
                  <div className="route-persona-tabs">
                    {PERSONAS.map(persona => (
                      <button
                        key={persona.id}
                        type="button"
                        className={'route-persona-tab' + (routeAudience === persona.id ? ' active' : '')}
                        onClick={() => setRouteAudience(persona.id)}
                      >
                        {persona.title}
                      </button>
                    ))}
                  </div>

                  <div className="route-persona-card">
                    <div className="route-detail-kicker">Persona-led recommendations</div>
                    <h3>{currentPersona.title}</h3>
                    <p>{currentPersona.description}</p>
                    <div className="route-persona-meta">
                      <span>{filteredRouteEntries.length} matching routes</span>
                      <button type="button" className="route-reset-button" onClick={() => selectRoute('all')}>
                        Show all visible places
                      </button>
                    </div>
                    <div className="route-length-row">
                      {[
                        [3, 'Quick'],
                        [4, 'Focused'],
                        [6, 'Extended']
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={'route-length-chip' + (routeStopLimit === value ? ' active' : '')}
                          onClick={() => setRouteStopLimit(value)}
                        >
                          {label} {value} stops
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeRoute !== 'all' && routeDetails[activeRoute] ? (
                    <div className="route-detail-card">
                      <div className="route-detail-head">
                        <div className="route-detail-kicker">Selected Route</div>
                        <h3>{routeDetails[activeRoute].label}</h3>
                        <p>{routeDetails[activeRoute].description}</p>
                      </div>

                      <div className="route-detail-stats">
                        <div className="route-detail-stat">
                          <strong>{routeDetails[activeRoute].stops.length}</strong>
                          <span>suggested stops</span>
                        </div>
                        <div className="route-detail-stat">
                          <strong>{routeDetails[activeRoute].count}</strong>
                          <span>candidate sites</span>
                        </div>
                        <div className="route-detail-stat">
                          <strong>{routeDetails[activeRoute].quietCount}</strong>
                          <span>quiet hidden</span>
                        </div>
                        <div className="route-detail-stat">
                          <strong>{routeDetails[activeRoute].avgWalk ?? 'n/a'}</strong>
                          <span>{routeDetails[activeRoute].avgWalk == null ? 'walk' : 'min walk avg'}</span>
                        </div>
                      </div>

                      <div className="route-detail-section">
                        <div className="route-detail-label">Best for</div>
                        <div className="badge-wrap">
                          {(routeDetails[activeRoute].recommended_for || []).map(item => (
                            <span key={item} className="badge badge-audience">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="route-detail-section">
                        <div className="route-detail-label">Why recommended</div>
                        <p className="route-detail-text">{routeDetails[activeRoute].why || routeDetails[activeRoute].focus}</p>
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
                        <div className="route-detail-label">Nearby TfL access</div>
                        <div className="badge-wrap">
                          {routeDetails[activeRoute].stations.map(item => (
                            <span key={item.label} className="badge">
                              {item.label} {item.count}
                            </span>
                          ))}
                          {routeDetails[activeRoute].lines.map(item => (
                            <span key={item.label} className="badge badge-soft">
                              {item.label} {item.count}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="route-detail-section">
                        <div className="route-detail-label">Step-by-step explorer</div>
                        <p className="route-detail-text">
                          Move through each leg of the route and preview the actual walking path between the current pair of stops.
                        </p>
                        {currentLeg ? (
                          <div className="route-stepper">
                            <div className="route-stepper-head">
                              <span className="route-stepper-pill">
                                Leg {Math.min(routeLegIndex + 1, currentLegs.length)} / {currentLegs.length}
                              </span>
                              <div className="route-stepper-actions">
                                <button type="button" onClick={() => jumpToLeg(routeLegIndex - 1)} disabled={routeLegIndex === 0}>
                                  Previous
                                </button>
                                <button
                                  type="button"
                                  onClick={() => jumpToLeg(routeLegIndex + 1)}
                                  disabled={routeLegIndex >= currentLegs.length - 1}
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                            <div className="route-stepper-card">
                              <strong>
                                {currentLeg.from.name} → {currentLeg.to.name}
                              </strong>
                              <span>
                                {routeHeadline}
                              </span>
                            </div>
                            {routeState.status === 'ready' && streetStepList.length ? (
                              <div className="route-turn-list">
                                {streetStepList.map((step, index) => (
                                  <div key={`${step.instruction}-${index}`} className="route-turn-item">
                                    <span className="route-turn-index">{index + 1}</span>
                                    <span className="route-turn-copy">
                                      <strong>{step.instruction}</strong>
                                      <span>{step.distanceM}m · about {step.durationMin} min</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="route-detail-section">
                        <div className="route-detail-label">Preview stops</div>
                        <div className="route-stop-list">
                          {routeDetails[activeRoute].stops.map((stop, index) => (
                            <button
                              key={stop.id}
                              type="button"
                              className="route-stop"
                              onClick={() => jumpToStop(index)}
                            >
                              <span className="route-stop-index">{index + 1}</span>
                              <span className="route-stop-copy">
                                <strong>{stop.name}</strong>
                                <span>
                                  {stop.borough}
                                  {stop.station ? ` · ${stop.station}` : ''}
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

                  <div className="route-list-heading">
                    <div className="route-detail-label">Recommended routes for this persona</div>
                  </div>

                  {filteredRouteEntries.map(([key, route]) => (
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
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
