import React from 'react';

export default function AboutSection({ counts, routeCount }) {
  return (
    <section className="about-section">
      <div className="about-shell">
        <div className="about-header">
          <div className="section-kicker">About us</div>
          <h2>How GemMap was built</h2>
          <p>
            GemMap is a design prototype for surfacing culturally significant but less-promoted London heritage through official
            blue plaque data, mobility context and environmental cues.
          </p>
        </div>

        <div className="about-grid">
          <div className="about-card">
            <h3>Data</h3>
            <ul>
              <li>{counts.official} official English Heritage blue plaques form the base dataset.</li>
              <li>TfL station and line context helps distinguish hidden from inaccessible.</li>
              <li>OSM tourism, green-space, water and road context supports the visibility and quietness logic.</li>
              <li>Greater London and borough boundaries frame the spatial interface.</li>
            </ul>
          </div>

          <div className="about-card">
            <h3>Method</h3>
            <ul>
              <li>Start with official plaques rather than user-generated heritage points.</li>
              <li>Filter for low tourism visibility, walkable TfL access and quieter environmental conditions.</li>
              <li>Separate point browsing from route guidance so users can either explore freely or follow a curated path.</li>
              <li>Translate the filtered set into {routeCount} guided routes and a map-based discovery interface.</li>
            </ul>
          </div>

          <div className="about-card">
            <h3>Why routes matter</h3>
            <ul>
              <li>Quiet Cultural Seeker routes prioritise calm and reflective settings.</li>
              <li>Experienced London Visitor routes surface places beyond the usual landmark circuit.</li>
              <li>Community Heritage Advocate routes show clusters that can support local heritage conversations.</li>
            </ul>
          </div>

          <div className="about-card">
            <h3>Responsibility</h3>
            <ul>
              <li>Recommending hidden gems can change them, especially in quieter residential settings.</li>
              <li>Travel experience matters: busy crossings, major roads and uncomfortable approaches should be surfaced early.</li>
              <li>Contribution features should not publish new sites automatically without moderation or local sensitivity checks.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
