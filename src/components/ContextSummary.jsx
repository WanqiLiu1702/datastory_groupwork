import React from 'react';

function firstItem(items = []) {
  return items.length ? items[0] : null;
}

export default function ContextSummary({ selectedFeature, selectedSiteContext, activeContextLayers }) {
  if (!selectedFeature || !selectedSiteContext) return null;

  const cards = [];

  if (activeContextLayers.tourism) {
    const count = selectedFeature.properties.osm_tourism_500m || 0;
    const nearest = firstItem(selectedSiteContext.tourism);
    cards.push({
      key: 'tourism',
      label: 'OSM tourism',
      text: count === 0 ? 'No tourism POIs within 500m' : `${count} nearby · ${nearest?.label || 'Nearest POI'}`
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
