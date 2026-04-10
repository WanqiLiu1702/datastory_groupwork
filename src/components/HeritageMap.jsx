import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  CAT_COLORS,
  CAT_LABELS,
  CONTEXT_LABELS,
  OPENING_LABELS,
  ROUTE_COLORS,
  TOURISM_TYPE_COLORS,
  TOURISM_TYPE_LABELS
} from '../constants.js';

function hexToRgba(hex, alpha) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized
        .split('')
        .map(char => char + char)
        .join('')
    : normalized;
  const intValue = parseInt(value, 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function tourismTypeLabel(type = 'other') {
  return TOURISM_TYPE_LABELS[type] || type.replace(/_/g, ' ');
}

function summarizeTourism(items = []) {
  if (!items.length) return 'None within 500m';

  const counts = new Map();
  for (const item of items) {
    const key = item.type || 'other';
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const summary = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, count]) => `${tourismTypeLabel(type)} ${count}`)
    .join(' · ');

  return `${items.length} nearby · ${summary}`;
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

function buildIcon(category, properties) {
  const color = CAT_COLORS[category] || '#5f826f';
  return L.divIcon({
    className: '',
    html: `
      <div
        class="marker-dot ${properties.hidden_quiet ? 'quiet' : ''}"
        style="--marker-fill:${hexToRgba(color, 0.42)}; --marker-stroke:${color}; --marker-halo:${hexToRgba(color, 0.18)};"
      ></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });
}

function popupReasons(reasons = []) {
  return reasons.map(reason => `<li>${reason}</li>`).join('');
}

function popupLines(lines = []) {
  return lines.map(line => `<span class="badge">${line}</span>`).join(' ');
}

function buildPopup(properties, siteContext) {
  const env = '●'.repeat(properties.environment_score) + '○'.repeat(5 - properties.environment_score);
  const hiddenLabel = properties.hidden_quiet ? 'Quiet hidden' : properties.hidden_core ? 'Core hidden' : 'Official plaque';
  const travelTiming =
    properties.walk_minutes_from_station == null || properties.cycle_minutes_from_station == null
      ? 'No nearby station timing available'
      : `${properties.walk_minutes_from_station} min walk · ${properties.cycle_minutes_from_station} min cycle`;
  const nearestStationText =
    properties.nearest_station && properties.station_distance_m != null
      ? `${properties.nearest_station} (${properties.station_distance_m}m)`
      : 'No nearby TfL station in current dataset';
  const tourismSummary = summarizeTourism(siteContext?.tourism || []);
  const landscapeSummary = [
    `Green ${properties.green_space_distance_m ?? 'n/a'}m`,
    `Water ${properties.water_feature_distance_m ?? 'n/a'}m`,
    `Road ${properties.major_road_distance_m ?? 'n/a'}m`
  ].join(' · ');

  return `
    <div>
      <p class="popup-name">${properties.name}</p>
      <p class="popup-address">${properties.address}</p>
      <p class="popup-desc">${properties.summary}</p>
      <div class="badge-wrap popup-badges">
        <span class="badge badge-hidden">${hiddenLabel}</span>
        <span class="badge">${CAT_LABELS[properties.category] || properties.category}</span>
        <span class="badge">${CONTEXT_LABELS[properties.place_context] || properties.place_context}</span>
      </div>
      <div class="popup-row"><strong>Quietness</strong><span title="Environment score ${properties.environment_score}/5">${env}</span></div>
      <div class="popup-row"><strong>Nearest TfL</strong><span>${nearestStationText}</span></div>
      <div class="popup-row"><strong>Walk / cycle</strong><span>${travelTiming}</span></div>
      <div class="popup-row"><strong>Travel feel</strong><span>${properties.approach_quality}</span></div>
      <div class="popup-row"><strong>Street access</strong><span>${OPENING_LABELS[properties.opening_status] || properties.opening_status}</span></div>
      <div class="popup-row"><strong>Tourism nearby</strong><span>${tourismSummary}</span></div>
      <div class="popup-row"><strong>Landscape</strong><span>${landscapeSummary}</span></div>
      ${properties.station_lines?.length ? `<div class="popup-section"><strong>TfL lines</strong><div class="badge-wrap">${popupLines(properties.station_lines)}</div></div>` : ''}
      <div class="popup-section">
        <a class="popup-link" href="${properties.path}" target="_blank" rel="noreferrer">Open official English Heritage page</a>
      </div>
    </div>
  `;
}

function orderedLatLngs(features) {
  if (features.length <= 2) {
    return features.map(feature => [feature.geometry.coordinates[1], feature.geometry.coordinates[0]]);
  }

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

  return ordered.map(feature => [feature.geometry.coordinates[1], feature.geometry.coordinates[0]]);
}

function offsetLatLng(lat, lon, eastMeters = 0, northMeters = 0) {
  const latOffset = northMeters / 111320;
  const lonOffset = eastMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lat + latOffset, lon + lonOffset];
}

export default function HeritageMap({
  features,
  route,
  routeDefs,
  routeLeg,
  routeDirections,
  boundary,
  boroughBoundaries,
  activeBorough,
  routeStationMarkers,
  selectedFeature,
  selectedSiteContext,
  siteContextById,
  activeContextLayers,
  onMapReady,
  onFeatureSelect,
  onClearSelection
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const lineRef = useRef(null);
  const boundaryRef = useRef(null);
  const boroughRef = useRef(null);
  const routeStationRef = useRef(null);
  const accessRingRef = useRef(null);
  const contextLayerRef = useRef(null);
  const markerByIdRef = useRef({});
  const siteContextRef = useRef(siteContextById);

  useEffect(() => {
    siteContextRef.current = siteContextById;
  }, [siteContextById]);

  function clearAccessRing(map) {
    if (accessRingRef.current) {
      map.removeLayer(accessRingRef.current);
      accessRingRef.current = null;
    }
  }

  function showAccessRing(map, latlng) {
    clearAccessRing(map);
    const group = L.layerGroup();
    const ring10 = L.circle(latlng, {
      radius: 800,
      color: '#355f5b',
      weight: 2,
      opacity: 0.95,
      fillOpacity: 0,
      dashArray: '12 10'
    });
    const ring20 = L.circle(latlng, {
      radius: 1600,
      color: '#6f8f89',
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0,
      dashArray: '12 10'
    });

    const label10 = L.marker(offsetLatLng(latlng.lat, latlng.lng, 820, 0), {
      icon: L.divIcon({
        className: 'range-label-marker',
        html: '<span class="range-label">10 min walk</span>',
        iconSize: [96, 24],
        iconAnchor: [0, 12]
      })
    });
    const label20 = L.marker(offsetLatLng(latlng.lat, latlng.lng, 1620, 0), {
      icon: L.divIcon({
        className: 'range-label-marker',
        html: '<span class="range-label secondary">20 min walk</span>',
        iconSize: [102, 24],
        iconAnchor: [0, 12]
      })
    });

    group.addLayer(ring20);
    group.addLayer(ring10);
    group.addLayer(label10);
    group.addLayer(label20);
    group.addTo(map);
    accessRingRef.current = group;
  }

  function clearContextLayers(map) {
    if (contextLayerRef.current) {
      map.removeLayer(contextLayerRef.current);
      contextLayerRef.current = null;
    }
  }

  function clearRouteStations(map) {
    if (routeStationRef.current) {
      map.removeLayer(routeStationRef.current);
      routeStationRef.current = null;
    }
  }

  function renderContextLayers(map, feature, context, toggles) {
    clearContextLayers(map);
    if (!feature || !context) return;
    const [lon, lat] = feature.geometry.coordinates;
    const group = L.layerGroup();

    if (toggles.tourism) {
      for (const item of context.tourism || []) {
        const color = TOURISM_TYPE_COLORS[item.type] || '#c5846e';
        const marker = L.marker([item.lat, item.lon], {
          icon: L.divIcon({
            className: '',
            html: `
              <span class="context-symbol tourism" style="--context-accent:${color}; --context-bg:${hexToRgba(color, 0.18)};"></span>
            `,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          }),
          zIndexOffset: 300
        }).bindTooltip(`${tourismTypeLabel(item.type)} · ${item.label} · ${item.distance_m}m`, {
          direction: 'top',
          offset: [0, -6]
        });
        group.addLayer(marker);
      }
    }

    if (toggles.green) {
      for (const item of context.green || []) {
        group.addLayer(
          L.circle([item.lat, item.lon], {
            radius: 95,
            color: '#4f7a46',
            weight: 2,
            opacity: 0.85,
            fillColor: '#7da270',
            fillOpacity: 0.1,
            dashArray: '8 8'
          }).bindTooltip(`Green space · ${item.label} · ${item.distance_m}m`, { direction: 'top' })
        );
      }
    }

    if (toggles.water) {
      for (const item of context.water || []) {
        group.addLayer(
          L.circle([item.lat, item.lon], {
            radius: 120,
            color: '#416c92',
            weight: 2,
            opacity: 0.9,
            fillColor: '#6d95c0',
            fillOpacity: 0.08,
            dashArray: '4 9'
          }).bindTooltip(`Water feature · ${item.label} · ${item.distance_m}m`, { direction: 'top' })
        );
      }
    }

    if (toggles.roads) {
      for (const item of context.roads || []) {
        group.addLayer(
          L.polyline(item.geometry, {
            color: 'rgba(255,255,255,0.92)',
            weight: 10,
            opacity: 0.9,
            lineCap: 'round'
          })
        );
        group.addLayer(
          L.polyline(item.geometry, {
            color: '#b25a36',
            weight: 6.5,
            opacity: 0.95,
            lineCap: 'round'
          }).bindTooltip(`${item.label} · ${item.distance_m}m`, { sticky: true })
        );
      }
    }

    if (Object.values(toggles).some(Boolean)) {
      group.addTo(map);
      contextLayerRef.current = group;
    }
  }

  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      scrollWheelZoom: true
    }).setView([51.515, -0.13], 11);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('click', () => {
      clearAccessRing(map);
      clearContextLayers(map);
      if (onClearSelection) {
        onClearSelection();
      }
    });

    mapRef.current = map;

    if (onMapReady) {
      onMapReady({
        focusFeature(id) {
          const marker = markerByIdRef.current[id];
          if (marker) {
            map.setView(marker.getLatLng(), 15, { animate: true });
            showAccessRing(map, marker.getLatLng());
            marker.openPopup();
          }
        }
      });
    }
  }, [onClearSelection, onMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (boroughRef.current) {
      map.removeLayer(boroughRef.current);
      boroughRef.current = null;
    }

    if (boroughBoundaries) {
      boroughRef.current = L.geoJSON(boroughBoundaries, {
        style: feature => {
          const isActive = activeBorough && normalizeBoroughName(feature?.properties?.name || '') === activeBorough;
          return {
            color: isActive ? '#355f5b' : '#7b7369',
            weight: isActive ? 2.4 : 1,
            opacity: isActive ? 0.85 : 0.34,
            fillOpacity: 0,
            dashArray: isActive ? null : '3 6'
          };
        },
        interactive: false
      }).addTo(map);
    }

    if (boundaryRef.current) {
      map.removeLayer(boundaryRef.current);
      boundaryRef.current = null;
    }

    if (boundary) {
      boundaryRef.current = L.geoJSON(boundary, {
        style: {
          color: '#1e574b',
          weight: 2,
          opacity: 0.95,
          fillOpacity: 0,
          dashArray: '10 8'
        },
        interactive: false
      }).addTo(map);
    }

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (lineRef.current) {
      map.removeLayer(lineRef.current);
      lineRef.current = null;
    }
    clearRouteStations(map);
    clearAccessRing(map);
    clearContextLayers(map);

    markerByIdRef.current = {};

    if (!features.length) {
      if (boundaryRef.current) {
        map.fitBounds(boundaryRef.current.getBounds(), { padding: [32, 32] });
      }
      return;
    }

    const group = L.featureGroup();
    features.forEach(feature => {
      const [lon, lat] = feature.geometry.coordinates;
      const marker = L.marker([lat, lon], {
        icon: buildIcon(feature.properties.category, feature.properties)
      })
        .bindPopup(buildPopup(feature.properties, siteContextRef.current?.[feature.properties.id]), { maxWidth: 360 })
        .bindTooltip(feature.properties.name, {
          direction: 'top',
          offset: [0, -12],
          opacity: 0.98,
          className: 'heritage-hover-label'
        });

      marker.on('click', event => {
        event.originalEvent?.stopPropagation?.();
        marker.setPopupContent(buildPopup(feature.properties, siteContextRef.current?.[feature.properties.id]));
        showAccessRing(map, marker.getLatLng());
        if (onFeatureSelect) {
          onFeatureSelect(feature.properties.id);
        }
      });

      group.addLayer(marker);
      markerByIdRef.current[feature.properties.id] = marker;
    });

    group.addTo(map);
    layerRef.current = group;

    if (route !== 'all' && features.length > 1) {
      const routeColor = ROUTE_COLORS[route] || routeDefs[route]?.color || '#2b4a3f';
      const routeLatLngs =
        routeDirections?.coordinates?.length
          ? routeDirections.coordinates
          : routeLeg
            ? [
                [routeLeg.from.geometry.coordinates[1], routeLeg.from.geometry.coordinates[0]],
                [routeLeg.to.geometry.coordinates[1], routeLeg.to.geometry.coordinates[0]]
              ]
            : orderedLatLngs(features);

      lineRef.current = L.layerGroup();
      L.polyline(routeLatLngs, {
        color: 'rgba(255,255,255,0.92)',
        weight: 10,
        opacity: 0.92,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(lineRef.current);
      L.polyline(routeLatLngs, {
        color: routeColor,
        weight: 5,
        opacity: 0.82,
        dashArray: '10 8',
        lineCap: 'round',
        lineJoin: 'round',
        className: 'route-flow-line'
      }).addTo(lineRef.current);
      lineRef.current.addTo(map);

      if (routeStationMarkers?.length) {
        const stationLayer = L.layerGroup();
        for (const station of routeStationMarkers) {
          const marker = L.marker([station.lat, station.lon], {
            icon: L.divIcon({
              className: '',
              html: '<span class="route-station-marker"><span>TfL</span></span>',
              iconSize: [34, 22],
              iconAnchor: [17, 11]
            }),
            zIndexOffset: 340
          }).bindTooltip(
            `${station.name} · ${station.count} nearby stops${station.lines.length ? ` · ${station.lines.join(', ')}` : ''}`,
            {
              direction: 'top',
              offset: [0, -8]
            }
          );
          stationLayer.addLayer(marker);
        }
        stationLayer.addTo(map);
        routeStationRef.current = stationLayer;
      }

      map.fitBounds(lineRef.current.getBounds(), { padding: [40, 40] });
    } else {
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 13 });
    }
  }, [activeBorough, boroughBoundaries, boundary, features, onFeatureSelect, route, routeDefs, routeDirections, routeLeg, routeStationMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!selectedFeature) {
      clearContextLayers(map);
      clearAccessRing(map);
      return;
    }

    const [lon, lat] = selectedFeature.geometry.coordinates;
    showAccessRing(map, L.latLng(lat, lon));
    renderContextLayers(map, selectedFeature, selectedSiteContext, activeContextLayers);
  }, [activeContextLayers, selectedFeature, selectedSiteContext]);

  return <div ref={containerRef} className="map-container" />;
}
