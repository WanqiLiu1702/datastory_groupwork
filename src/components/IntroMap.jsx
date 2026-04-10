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
    }).setView([51.51, -0.13], 10.7);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

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
          opacity: 0.75,
          fillColor: '#eff7f3',
          fillOpacity: 0.18,
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
          radius: feature.properties.hidden_quiet ? 5.5 : 4.5,
          color,
          weight: 1.5,
          opacity: 0.6,
          fillColor: hexToRgba(color, 0.3),
          fillOpacity: 0.8
        }).addTo(group);
      });
      group.addTo(map);
      markersRef.current = group;
    }

    if (boundaryRef.current) {
      map.fitBounds(boundaryRef.current.getBounds(), { padding: [24, 24] });
    }
  }, [boundary, features]);

  return <div ref={containerRef} className="intro-map" />;
}
