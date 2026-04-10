import React from 'react';
import { TOURISM_TYPE_LABELS } from '../constants.js';

function firstItem(items = []) {
  return items.length ? items[0] : null;
}

function tourismTypeLabel(type = 'other') {
  return TOURISM_TYPE_LABELS[type] || type.replace(/_/g, ' ');
}

function tourismBreakdown(items = []) {
  if (!items.length) return 'No tourism POIs within 500m';

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

export default function ContextSummary({ selectedFeature, selectedSiteContext, activeContextLayers }) {
  if (!selectedFeature || !selectedSiteContext) return null;

  const cards = [];

  if (activeContextLayers.tourism) {
    const nearest = firstItem(selectedSiteContext.tourism);
    cards.push({
      key: 'tourism',
      label: 'OSM tourism',
      text: nearest
        ? `${tourismBreakdown(selectedSiteContext.tourism)} · nearest ${nearest.label}`
        : tourismBreakdown(selectedSiteContext.tourism)
    });
  }

  if (activeContextLayers.green) {
    const nearest = firstItem(selectedSiteContext.green);
    cards.push({
      key: 'green',
      label: 'Green space',
      text: nearest ? `${nearest.label} · ${nearest.distance_m}m` : 'No nearby green space tagged'
    });
  }

  if (activeContextLayers.water) {
    const nearest = firstItem(selectedSiteContext.water);
    cards.push({
      key: 'water',
      label: 'Water',
      text: nearest ? `${nearest.label} · ${nearest.distance_m}m` : 'No nearby water feature tagged'
    });
  }

  if (activeContextLayers.roads) {
    const nearest = firstItem(selectedSiteContext.roads);
    cards.push({
      key: 'roads',
      label: 'Major road',
      text: nearest ? `${nearest.label} · ${nearest.distance_m}m` : 'No major road close to this site'
    });
  }

  if (!cards.length) return null;

  return (
    <div className="context-summary">
      {cards.map(card => (
        <div key={card.key} className="context-card">
          <span className="context-card-label">{card.label}</span>
          <span className="context-card-text">{card.text}</span>
        </div>
      ))}
    </div>
  );
}
