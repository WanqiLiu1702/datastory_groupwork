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
  onOpenRoutes
}) {
  return (
    <section className="hero-section">
      <IntroMap boundary={boundary} features={heroFeatures} />
      <div className="hero-scrim" />

      <div className="hero-content">
        <div className="hero-copy">
          <div className="hero-kicker">GemMap</div>
          <h1>London’s Hidden Heritage Beyond Guidebooks</h1>
          <p className="hero-lead">
            Official English Heritage blue plaques, re-read through visibility, TfL access and quieter surroundings to reveal
            cultural sites that matter but are often missing from mainstream visitor flows.
          </p>

          <div className="hero-actions">
            <button type="button" className="hero-button hero-button-primary" onClick={onExploreMap}>
              Enter map explorer
            </button>
            <button type="button" className="hero-button hero-button-secondary" onClick={onOpenRoutes}>
              Open route guide
            </button>
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
          <div className="hero-route-kicker">Persona-led route guide</div>
          <h2>Start with routes, not just points</h2>
          <p>
            Route mode is now a first-class way into the project: short, walkable route sets tuned to different visitors and
            fitted to actual street paths.
          </p>

          <div className="hero-route-grid">
            {ROUTE_PERSONAS.map(persona => (
              <button
                key={persona.id}
                type="button"
                className={'hero-route-card' + (routeAudience === persona.id ? ' active' : '')}
                onClick={() => {
                  onChoosePersona(persona.id);
                  onOpenRoutes();
                }}
                style={{ '--hero-persona-accent': persona.accent }}
              >
                <span className="hero-route-badge">{persona.shortLabel}</span>
                <strong>{persona.title}</strong>
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
