import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CAT_COLORS } from '../constants.js';

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

export default function IntroMap({ boundary, features }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const boundaryRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      scrollWheelZoom: false,
      boxZoom: false,
      keyboard: false,
      attributionControl: false
    }).setView([51.515, -0.12], 11.05);

    mapRef.current = map;
  }, []);

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
          color: '#235d58',
          weight: 2,
          opacity: 0.62,
          fillColor: '#eef5f0',
          fillOpacity: 0.9,
          dashArray: '10 8'
        },
        interactive: false
      }).addTo(map);
    }

    if (markersRef.current) {
      map.removeLayer(markersRef.current);
      markersRef.current = null;
    }

    if (features?.length) {
      const group = L.featureGroup();
      features.forEach(feature => {
        const [lon, lat] = feature.geometry.coordinates;
        const color = CAT_COLORS[feature.properties.category] || '#6b8d86';
        L.circleMarker([lat, lon], {
          radius: feature.properties.hidden_quiet ? 5.2 : 4.6,
          color,
          weight: 1.5,
          opacity: 0.82,
          fillColor: hexToRgba(color, 0.24),
          fillOpacity: 0.78
        }).addTo(group);
      });
      group.addTo(map);
      markersRef.current = group;
    }

    map.setView([51.515, -0.12], 11.05, { animate: false });
  }, [boundary, features]);

  return <div ref={containerRef} className="intro-map" />;
}
