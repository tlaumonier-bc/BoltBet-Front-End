// lib/globeHandoff.ts — single source of truth for the 3D-globe ⇄ MapLibre swap.
// Tune these four numbers to change when the handoff happens.

export type Focus = { lat: number; lon: number };

export const HANDOFF = {
  // three.js OrbitControls camera distance (min 3, max 10 in LightningGlobe).
  // Smaller = more zoomed in. Zoom IN past this → switch to the MapLibre map.
  // Kept just below ORBIT_CAMERA_DISTANCE (3.4) so the /live "Orbit to" flights
  // don't accidentally trigger a handoff.
  toMapDistance: 3.2,

  // When we return to the 3D globe, start a bit further out so we don't
  // immediately re-cross toMapDistance.
  globeReturnDistance: 4.3,

  // MapLibre zoom the map opens at when we hand off from the globe.
  mapStartZoom: 4.5,

  // Zoom OUT below this on the map → switch back to the 3D globe.
  toGlobeZoom: 3.2,
};