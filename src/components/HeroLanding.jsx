import React from 'react';
import IntroMap from './IntroMap.jsx';
import { ROUTE_PERSONAS } from '../constants.js';

export default function HeroLanding({
  boundary,
  heroFeatures,
  counts,
  routeDefs,
  routeAudience,
  routePersonaCounts,
  onChoosePersona,
  onExploreMap,
  onOpenPlaces,
  onOpenRoutes
}) {
  return (
    <section className="hero-section">
      <IntroMap boundary={boundary} features={heroFeatures} />
      <div className="hero-scrim" />

      <div className="hero-content">
        <div className="hero-copy">
          <div className="hero-kicker">Hidden heritage discovery prototype</div>
          <h1>GemMap: London’s Hidden Heritage Beyond Guidebooks</h1>
          <p className="hero-lead">
            Official English Heritage blue plaques, re-read through visibility, TfL access and quieter surroundings to reveal
            cultural sites that matter but are often missing from mainstream visitor flows.
          </p>

          <div className="hero-actions">
            <button type="button" className="hero-button hero-button-primary" onClick={onOpenPlaces}>
              Open places explorer
            </button>
            <button type="button" className="hero-button hero-button-secondary" onClick={() => onOpenRoutes()}>
              Open route guide
            </button>
          </div>

          <div className="hero-method-card">
            <div className="hero-method-head">
              <div className="hero-route-kicker">Method</div>
              <span>Official plaques + TfL + OSM context</span>
            </div>
            <div className="hero-method-steps">
              <div className="hero-method-step">
                <strong>1</strong>
                <span>Start from 1,028 official English Heritage blue plaques across Greater London.</span>
              </div>
              <div className="hero-method-step">
                <strong>2</strong>
                <span>Define hidden places through low tourism visibility, walkable TfL access and quieter environmental cues.</span>
              </div>
              <div className="hero-method-step">
                <strong>3</strong>
                <span>Turn filtered sites into persona-led route suggestions and place-based map exploration.</span>
              </div>
            </div>
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <strong>{counts.official}</strong>
              <span>official plaques</span>
            </div>
            <div className="hero-stat">
              <strong>{counts.core}</strong>
              <span>core hidden</span>
            </div>
            <div className="hero-stat">
              <strong>{counts.quiet}</strong>
              <span>quiet hidden</span>
            </div>
            <div className="hero-stat">
              <strong>{Object.keys(routeDefs).length}</strong>
              <span>guided routes</span>
            </div>
          </div>
        </div>

        <div className="hero-route-spotlight">
          <div className="hero-route-kicker">Choose an entry mode</div>
          <h2>Browse points or open a guided walk</h2>
          <p>
            Use the map as a place browser, or jump straight into a route guide tuned to a different visitor persona.
          </p>

          <div className="hero-entry-row">
            <button type="button" className="hero-entry-card" onClick={onOpenPlaces}>
              <span className="hero-entry-kicker">Places</span>
              <strong>Free exploration</strong>
              <span>Filter plaques by theme, borough and quietness.</span>
            </button>
            <button type="button" className="hero-entry-card hero-entry-card-route" onClick={() => onOpenRoutes()}>
              <span className="hero-entry-kicker">Routes</span>
              <strong>Persona-led guide</strong>
              <span>Open walkable routes with step-by-step street paths.</span>
            </button>
          </div>

          <div className="hero-route-grid">
            {ROUTE_PERSONAS.map(persona => (
              <button
                key={persona.id}
                type="button"
                className={'hero-route-card' + (routeAudience === persona.id ? ' active' : '')}
                onClick={() => {
                  onChoosePersona(persona.id);
                  onOpenRoutes(persona.id);
                }}
                style={{ '--hero-persona-accent': persona.accent }}
              >
                <span className="hero-route-badge">{persona.shortLabel}</span>
                <strong>{persona.title}</strong>
                <span className="hero-route-description">{persona.description}</span>
                <span>{routePersonaCounts[persona.id] || 0} matching routes</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button type="button" className="hero-scroll-cue" onClick={onExploreMap}>
        Scroll into map
      </button>
    </section>
  );
}
