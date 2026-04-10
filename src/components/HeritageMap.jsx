import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  CAT_LABELS,
  CONTEXT_LABELS,
  OPENING_LABELS
} from '../constants.js';

function buildIcon(category, properties) {
  return L.divIcon({
    className: '',
    html: `
      <div class="marker-pin cat-${category} ${properties.hidden_quiet ? 'quiet' : ''}">
        <span>${properties.hidden_quiet ? '●' : '♦'}</span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -24]
  });
}

function popupReasons(reasons = []) {
  return reasons.map(reason => `<li>${reason}</li>`).join('');
}

function popupLines(lines = []) {
  return lines.map(line => `<span class="badge">${line}</span>`).join(' ');
}

function buildPopup(properties) {
  const env = '●'.repeat(properties.environment_score) + '○'.repeat(5 - properties.environment_score);
  const official = (properties.official_categories || [])
    .map(category => `<span class="badge">${category}</span>`)
    .join(' ');
  const travelTiming =
    properties.walk_minutes_from_station == null || properties.cycle_minutes_from_station == null
      ? 'No nearby station timing available'
      : `${properties.walk_minutes_from_station} min walk · ${properties.cycle_minutes_from_station} min cycle`;
  const nearestStationText =
    properties.nearest_station && properties.station_distance_m != null
      ? `${properties.nearest_station} (${properties.station_distance_m}m)`
      : 'No nearby TfL station in current dataset';

  return `
    <div>
      <p class="popup-name">${properties.name}</p>
      <p class="popup-address">${properties.address}</p>
      <p class="popup-desc">${properties.summary}</p>
      <div class="popup-row"><strong>Theme</strong><span>${CAT_LABELS[properties.category] || properties.category}</span></div>
      <div class="popup-row"><strong>Context</strong><span>${CONTEXT_LABELS[properties.place_context] || properties.place_context}</span></div>
      <div class="popup-row"><strong>Visibility</strong><span>${properties.hidden_quiet ? 'Quiet hidden' : properties.hidden_core ? 'Core hidden' : 'Official plaque'}</span></div>
      <div class="popup-row"><strong>Opening</strong><span>${OPENING_LABELS[properties.opening_status] || properties.opening_status}</span></div>
      <div class="popup-row"><strong>Building access</strong><span>${properties.opening_info}</span></div>
      <div class="popup-row"><strong>Quietness</strong><span title="Environment score ${properties.environment_score}/5">${env}</span></div>
      <div class="popup-row"><strong>Nearest TfL</strong><span>${nearestStationText}</span></div>
      <div class="popup-row"><strong>Walk / cycle</strong><span>${travelTiming}</span></div>
      <div class="popup-row"><strong>Access</strong><span>${properties.station_access_via_lift ? 'Lift access nearby' : 'Standard access'}</span></div>
      <div class="popup-row"><strong>Travel feel</strong><span>${properties.approach_quality}</span></div>
      <div class="popup-row"><strong>OSM tourism</strong><span>${properties.osm_tourism_500m} POIs within 500m</span></div>
      <div class="popup-row"><strong>Green space</strong><span>${properties.green_space_distance_m}m</span></div>
      <div class="popup-row"><strong>Water</strong><span>${properties.water_feature_distance_m == null ? 'No nearby feature tagged' : `${properties.water_feature_distance_m}m`}</span></div>
      <div class="popup-row"><strong>Major road</strong><span>${properties.major_road_distance_m}m away</span></div>
      ${official ? `<div class="popup-section"><strong>Official categories</strong><div class="badge-wrap">${official}</div></div>` : ''}
      ${properties.station_lines?.length ? `<div class="popup-section"><strong>TfL lines</strong><div class="badge-wrap">${popupLines(properties.station_lines)}</div></div>` : ''}
      ${properties.approach_note ? `<div class="popup-section"><strong>Approach note</strong><p class="popup-note">${properties.approach_note}</p></div>` : ''}
      ${properties.hidden_reasons?.length ? `<div class="popup-section"><strong>Why it qualifies</strong><ul class="popup-list">${popupReasons(properties.hidden_reasons)}</ul></div>` : ''}
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

export default function HeritageMap({ features, route, routeDefs, boundary, onMapReady }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const lineRef = useRef(null);
  const boundaryRef = useRef(null);
  const markerByIdRef = useRef({});

  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([51.515, -0.13], 11);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    mapRef.current = map;

    if (onMapReady) {
      onMapReady({
        focusFeature(id) {
          const marker = markerByIdRef.current[id];
          if (marker) {
            map.setView(marker.getLatLng(), 15, { animate: true });
            marker.openPopup();
          }
        }
      });
    }
  }, [onMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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
      }).bindPopup(buildPopup(feature.properties), { maxWidth: 360 });

      group.addLayer(marker);
      markerByIdRef.current[feature.properties.id] = marker;
    });

    group.addTo(map);
    layerRef.current = group;

    if (route !== 'all' && features.length > 1) {
      lineRef.current = L.polyline(orderedLatLngs(features), {
        color: routeDefs[route]?.color || '#2b4a3f',
        weight: 4,
        opacity: 0.65,
        dashArray: '8 8'
      }).addTo(map);
      map.fitBounds(lineRef.current.getBounds(), { padding: [40, 40] });
    } else {
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 13 });
    }
  }, [boundary, features, route, routeDefs]);

  return <div ref={containerRef} className="map-container" />;
}
