import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';

function formatCoordinate(value) {
  return value == null ? 'Not set' : value.toFixed(4);
}

export default function StoryContributionSection({ boundary, onOpenPlaces, onOpenRoutes }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const boundaryRef = useRef(null);
  const markerRef = useRef(null);
  const [suggestion, setSuggestion] = useState({
    name: '',
    borough: '',
    story: '',
    reason: '',
    email: ''
  });
  const [pickedLocation, setPickedLocation] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false
    }).setView([51.515, -0.12], 10.9);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    map.on('click', event => {
      const next = {
        lat: event.latlng.lat,
        lng: event.latlng.lng
      };
      setPickedLocation(next);
      setSubmitted(false);
    });

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
          opacity: 0.7,
          fillColor: '#eff7f3',
          fillOpacity: 0.08,
          dashArray: '10 8'
        },
        interactive: false
      }).addTo(map);
    }
  }, [boundary]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!pickedLocation) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      return;
    }

    if (!markerRef.current) {
      markerRef.current = L.circleMarker([pickedLocation.lat, pickedLocation.lng], {
        radius: 9,
        color: '#2f6d67',
        weight: 2,
        fillColor: '#7bb5ad',
        fillOpacity: 0.35
      }).addTo(map);
    } else {
      markerRef.current.setLatLng([pickedLocation.lat, pickedLocation.lng]);
    }

    map.panTo([pickedLocation.lat, pickedLocation.lng], { animate: true, duration: 0.6 });
  }, [pickedLocation]);

  const coordinateSummary = useMemo(() => {
    return `${formatCoordinate(pickedLocation?.lat)}, ${formatCoordinate(pickedLocation?.lng)}`;
  }, [pickedLocation]);

  const handleSubmit = event => {
    event.preventDefault();
    setSubmitted(true);
    setSuggestion({
      name: '',
      borough: '',
      story: '',
      reason: '',
      email: ''
    });
  };

  return (
    <section className="story-section">
      <div className="story-shell">
        <div className="story-copy">
          <div className="section-kicker">Uncover Stories</div>
          <h2>Suggest a hidden heritage site we have not mapped yet</h2>
          <p>
            This prototype contribution mode lets visitors place a missing site on the map, explain why it matters and flag
            what kind of hidden story it carries.
          </p>

          <div className="story-guidance">
            <div>
              <strong>1</strong>
              <span>Click somewhere in London on the map to set a location.</span>
            </div>
            <div>
              <strong>2</strong>
              <span>Add a name, a short story and why the site feels hidden or overlooked.</span>
            </div>
            <div>
              <strong>3</strong>
              <span>Use this as a discovery prompt, not a public publishing tool. Sensitive places still need careful review.</span>
            </div>
          </div>

          <div className="story-actions">
            <button type="button" className="hero-button hero-button-secondary" onClick={onOpenPlaces}>
              Back to places
            </button>
            <button type="button" className="hero-button hero-button-primary" onClick={() => onOpenRoutes()}>
              Browse routes instead
            </button>
          </div>
        </div>

        <div className="story-stage">
          <div ref={containerRef} className="story-map" />

          <form className="story-form" onSubmit={handleSubmit}>
            <div className="story-form-head">
              <div className="section-kicker">Suggested site draft</div>
              <strong>{pickedLocation ? 'Location captured' : 'Click map to place a point'}</strong>
              <span>{coordinateSummary}</span>
            </div>

            <label>
              <span>Site name</span>
              <input
                type="text"
                value={suggestion.name}
                onChange={event => setSuggestion(current => ({ ...current, name: event.target.value }))}
                placeholder="Name of the overlooked site"
              />
            </label>

            <label>
              <span>Borough</span>
              <input
                type="text"
                value={suggestion.borough}
                onChange={event => setSuggestion(current => ({ ...current, borough: event.target.value }))}
                placeholder="Borough or area"
              />
            </label>

            <label>
              <span>Why it matters</span>
              <textarea
                value={suggestion.story}
                onChange={event => setSuggestion(current => ({ ...current, story: event.target.value }))}
                placeholder="What cultural story should this place surface?"
                rows="3"
              />
            </label>

            <label>
              <span>Why it feels hidden</span>
              <textarea
                value={suggestion.reason}
                onChange={event => setSuggestion(current => ({ ...current, reason: event.target.value }))}
                placeholder="Missing from guidebooks, low tourism visibility, quiet local setting..."
                rows="3"
              />
            </label>

            <label>
              <span>Contact email (optional)</span>
              <input
                type="email"
                value={suggestion.email}
                onChange={event => setSuggestion(current => ({ ...current, email: event.target.value }))}
                placeholder="For follow-up only"
              />
            </label>

            <button type="submit" className="story-submit" disabled={!pickedLocation || !suggestion.name || !suggestion.story}>
              Save local prototype draft
            </button>

            <p className="story-note">
              No live server submission yet. Suggestions stay inside this prototype session until a moderated backend is
              added, with checks for community sensitivity before surfacing a place on the map.
            </p>

            {submitted ? (
              <div className="story-success">
                Local draft captured for <strong>{pickedLocation ? coordinateSummary : 'this point'}</strong>. Nothing is sent
                or published automatically.
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}
