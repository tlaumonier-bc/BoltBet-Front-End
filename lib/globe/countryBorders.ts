// lib/globe/countryBorders.ts
// Crisp vector country borders + screen-space name labels from a Natural Earth
// admin-0 GeoJSON at /public/geo/countries.geojson.
// When `interactive` is provided, EVERY country becomes interactive:
//   • hover  -> a subtle glowing border (invites a click)
//   • click  -> a stronger, pulsing "light up" that stays on, + an adaptive
//               fly-in framed on the country's bounding box (or, for countries
//               that wrap the ±180° antimeridian, on the main landmass center),
//               and the country is written to liveStore.selectedCountry (drives
//               the right-hand CountryPanel + the per-country strikes layer).
//   • click again on the selected country (or close the panel) -> deselect and
//               zoom straight back out in place (no recentering).
// Countries that have a page (a CountryLink) also expose their slug via onPick.

import * as Cesium from 'cesium';
import { useLiveStore } from '@/store/liveStore';
import {
  COUNTRY_BORDER_COLOR,
  COUNTRY_BORDER_WIDTH,
  COUNTRY_LABEL_COLOR,
  COUNTRY_LABEL_FONT,
  COUNTRY_LABEL_DISTANCE_PER_DEG,
} from './config';
import { framingBoundsForIso } from '@/lib/map/countryBounds';

const BORDER_LIFT = 1.0003; // ~2 km
const HOVER_COLOR = Cesium.Color.fromCssColorString('#38bdf8');
const HOVER_WIDTH = 3.0;
const HOVER_GLOW = 0.3;
const HOVER_FILL_ALPHA = 0.12;
const SEL_REST = { width: 4.0, glow: 0.5, fill: 0.18 };
const SEL_PEAK = { width: 7.0, glow: 1.0, fill: 0.42 };
const PULSE_MS = 700;
const COUNTRY_FLY_PADDING = 1.4; // breathing room around the country on zoom

export interface CountryLink {
  iso: string;
  names: string[];
  slug: string;
  center?: { lat: number; lon: number };
  label?: string;
}

export interface CountryInteractivity {
  scene: Cesium.Scene;
  links: CountryLink[];
  onPick?: (slug: string) => void;
  /** Only used to decide how far to pull back on deselect. */
  homeBounds?: { minLon: number; minLat: number; maxLon: number; maxLat: number } | null;
}

interface DetectPoly {
  id: string;
  outer: number[][]; // [ [lon,lat], ... ]
  holes: number[][][];
  bbox: [number, number, number, number]; // minLon, minLat, maxLon, maxLat
}

interface CountryMeta {
  slug?: string; // present only for countries that have a page
  iso2: string | null; // ISO alpha-2 (uppercase) for the country-strikes endpoint
  center: { lat: number; lon: number };     // link-provided or rect center
  mainCenter: { lat: number; lon: number };  // centroid of the largest ring (robust to antimeridian)
  rect: Cesium.Rectangle; // union bounds — drives adaptive zoom
  label: string;
  size: number; // vertices of the largest ring seen (to pick the best center)
}

function lift(positions: Cesium.Cartesian3[]): Cesium.Cartesian3[] {
  return positions.map((p) =>
    Cesium.Cartesian3.multiplyByScalar(p, BORDER_LIFT, new Cesium.Cartesian3()),
  );
}

const norm = (s: string) => s.trim().toLowerCase();

function toLonLat(cs: Cesium.Cartesian3[], ell: Cesium.Ellipsoid): number[][] {
  const out: number[][] = [];
  for (const c of cs) {
    const carto = Cesium.Cartographic.fromCartesian(c, ell);
    if (carto) out.push([Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude)]);
  }
  return out;
}

function bboxOf(ring: number[][]): [number, number, number, number] {
  let minLon = 180, minLat = 90, maxLon = -180, maxLat = -90;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function expandRect(rect: Cesium.Rectangle, factor: number): Cesium.Rectangle {
  const w = (rect.width * (factor - 1)) / 2;
  const h = (rect.height * (factor - 1)) / 2;
  const HALF_PI = Math.PI / 2;
  const PI = Math.PI;
  return new Cesium.Rectangle(
    Math.max(-PI, rect.west - w),
    Math.max(-HALF_PI, rect.south - h),
    Math.min(PI, rect.east + w),
    Math.min(HALF_PI, rect.north + h),
  );
}

// True when the unioned rect can't be trusted for framing — either it literally
// spans >170° OR its center lands far from the country's main landmass, which
// happens when parts straddle the ±180° antimeridian (Canada, Russia, Fiji, the
// US with Alaska/Aleutians…). In those cases we frame by the main ring center.
function rectUntrustworthy(rect: Cesium.Rectangle, mainCenter: { lon: number }): boolean {
  if (Cesium.Math.toDegrees(rect.width) > 170) return true;
  const rectCenterLon = Cesium.Math.toDegrees(Cesium.Rectangle.center(rect).longitude);
  let d = Math.abs(rectCenterLon - mainCenter.lon);
  if (d > 180) d = 360 - d;
  return d > 40; // rect center > 40° of longitude from the main landmass = wrapped
}

export function loadCountryBorders(
  viewer: Cesium.Viewer,
  interactive?: CountryInteractivity,
): () => void {
  const byIso = new Map<string, CountryLink>();
  const byName = new Map<string, CountryLink>();
  if (interactive) {
    for (const link of interactive.links) {
      if (link.iso) byIso.set(norm(link.iso), link);
      for (const n of link.names) if (n) byName.set(norm(n), link);
    }
  }

  const polylinesById = new Map<string, Cesium.Entity[]>();
  const fillsById = new Map<string, Cesium.Entity[]>();
  const metaById = new Map<string, CountryMeta>();
  const detectPolys: DetectPoly[] = [];

  let handler: Cesium.ScreenSpaceEventHandler | null = null;
  let unsubStore: (() => void) | null = null;
  let pulseRaf = 0;
  let disposed = false;

  Cesium.GeoJsonDataSource.load('/geo/countries.geojson')
    .then((ds) => {
      if (disposed || viewer.isDestroyed()) return;
      const scene = viewer.scene;
      const camera = scene.camera;
      const ell = scene.globe.ellipsoid;
      const now = Cesium.JulianDate.now();
      const labels = new Map<string, { center: Cesium.Cartesian3; size: number; spanDeg: number }>();
      let drew = 0;
      let targeted = 0;

      for (const entity of ds.entities.values) {
        const hierarchy = entity.polygon?.hierarchy?.getValue(now) as
          | Cesium.PolygonHierarchy
          | undefined;
        if (!hierarchy) continue;

        const props = entity.properties as
          | Record<string, { getValue: (t: Cesium.JulianDate) => unknown } | undefined>
          | undefined;
        const name =
          (props?.ADMIN?.getValue(now) as string | undefined) ??
          (props?.NAME?.getValue(now) as string | undefined) ??
          (props?.name?.getValue(now) as string | undefined);
        const iso =
          (props?.ISO_A2_EH?.getValue(now) as string | undefined) ??
          (props?.ISO_A2?.getValue(now) as string | undefined) ??
          (props?.iso_a2?.getValue(now) as string | undefined);

        let link: CountryLink | undefined;
        if (interactive) {
          if (iso && iso !== '-99') link = byIso.get(norm(iso));
          if (!link && name) link = byName.get(norm(name));
          if (link) targeted++;
        }

        // A stable interactivity id for every country: page slug if any, else
        // ISO code, else name.
        const id = interactive
          ? link?.slug ??
            (iso && iso !== '-99' ? iso.toLowerCase() : undefined) ??
            (name ? norm(name) : undefined)
          : undefined;

        const holePositions = (hierarchy.holes ?? []).map((h) => h.positions);
        const rings = [hierarchy.positions, ...holePositions];

        for (const positions of rings) {
          if (!positions || positions.length < 2) continue;
          const raised = lift(positions);
          const pl = viewer.entities.add({
            polyline: {
              positions: raised.concat([raised[0]]),
              width: COUNTRY_BORDER_WIDTH,
              material: COUNTRY_BORDER_COLOR,
              arcType: Cesium.ArcType.GEODESIC,
            },
          });
          if (id) {
            const arr = polylinesById.get(id) ?? [];
            arr.push(pl);
            polylinesById.set(id, arr);
          }
          drew++;
        }

        const main = rings.reduce((a, b) => (b.length > a.length ? b : a));
        const rect = Cesium.Rectangle.fromCartesianArray(main);

        if (id) {
          const fill = viewer.entities.add({
            polygon: { hierarchy, material: HOVER_COLOR.withAlpha(0.0001), height: 1500 },
          });
          const arr = fillsById.get(id) ?? [];
          arr.push(fill);
          fillsById.set(id, arr);

          const outer = toLonLat(hierarchy.positions, ell);
          detectPolys.push({
            id,
            outer,
            holes: holePositions.map((h) => toLonLat(h, ell)),
            bbox: bboxOf(outer),
          });

          const cc = Cesium.Rectangle.center(rect);
          const geoCenter = {
            lat: Cesium.Math.toDegrees(cc.latitude),
            lon: Cesium.Math.toDegrees(cc.longitude),
          };
          // Arithmetic centroid of the largest ring's own points. Done in raw
          // lon/lat (NOT via Cesium.Rectangle, which applies antimeridian
          // wrapping and would put Canada's center out in the Pacific).
          const mainLonLat = toLonLat(main, ell);
          let sumLon = 0;
          let sumLat = 0;
          for (const [lo, la] of mainLonLat) {
            sumLon += lo;
            sumLat += la;
          }
          const ringCenter = {
            lat: mainLonLat.length ? sumLat / mainLonLat.length : geoCenter.lat,
            lon: mainLonLat.length ? sumLon / mainLonLat.length : geoCenter.lon,
          };

          const prev = metaById.get(id);
          // Union the rect across this country's parts so the fly-to frames it all.
          const unionRect = prev ? Cesium.Rectangle.union(prev.rect, rect) : rect;
          if (!prev || main.length > prev.size) {
            metaById.set(id, {
              slug: link?.slug,
              iso2: iso && iso !== '-99' ? iso.toUpperCase() : null,
              center: link?.center ?? geoCenter,
              mainCenter: ringCenter, // centroid of the largest ring so far
              rect: unionRect,
              label: link?.label ?? name ?? id,
              size: main.length,
            });
          } else {
            prev.rect = unionRect; // keep growing the union even for smaller parts
          }
        }

        if (!name) continue;
        const spanDeg = Cesium.Math.toDegrees(Math.max(rect.width, rect.height));
        const lx = props?.LABEL_X?.getValue(now) as number | undefined;
        const ly = props?.LABEL_Y?.getValue(now) as number | undefined;
        let center: Cesium.Cartesian3;
        if (typeof lx === 'number' && typeof ly === 'number') {
          center = Cesium.Cartesian3.fromDegrees(lx, ly, 20_000);
        } else {
          const carto = Cesium.Rectangle.center(rect);
          center = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 20_000);
        }
        const prevL = labels.get(name);
        if (!prevL || main.length > prevL.size) labels.set(name, { center, size: main.length, spanDeg });
      }

      const labelCollection = scene.primitives.add(new Cesium.LabelCollection());
      for (const [name, { center, spanDeg }] of labels) {
        labelCollection.add({
          position: center,
          text: name,
          font: COUNTRY_LABEL_FONT,
          fillColor: COUNTRY_LABEL_COLOR,
          outlineColor: Cesium.Color.BLACK.withAlpha(0.8),
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
            0.0,
            spanDeg * COUNTRY_LABEL_DISTANCE_PER_DEG,
          ),
          scaleByDistance: new Cesium.NearFarScalar(2.0e6, 1.0, 2.0e7, 0.55),
          disableDepthTestDistance: 0,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        });
      }

      if (drew === 0) console.warn('[globe] countries.geojson loaded but had no polygons.');
      if (!interactive) return;
      if (targeted === 0) {
        console.warn('[globe] no targeted (page) countries matched — hover/click still works for all.');
      }

      type Mode = 'off' | 'hover' | 'selected';
      let hovered: string | null = null;
      let selected: string | null = null;
      const sel = { ...SEL_REST };

      const applyMode = (id: string | null, mode: Mode) => {
        if (!id) return;
        for (const e of polylinesById.get(id) ?? []) {
          if (!e.polyline) continue;
          if (mode === 'off') {
            e.polyline.width = new Cesium.ConstantProperty(COUNTRY_BORDER_WIDTH);
            e.polyline.material = new Cesium.ColorMaterialProperty(COUNTRY_BORDER_COLOR);
          } else if (mode === 'hover') {
            e.polyline.width = new Cesium.ConstantProperty(HOVER_WIDTH);
            e.polyline.material = new Cesium.PolylineGlowMaterialProperty({
              color: HOVER_COLOR,
              glowPower: HOVER_GLOW,
            });
          } else {
            e.polyline.width = new Cesium.CallbackProperty(() => sel.width, false);
            e.polyline.material = new Cesium.PolylineGlowMaterialProperty({
              color: HOVER_COLOR,
              glowPower: new Cesium.CallbackProperty(() => sel.glow, false),
            });
          }
        }
        for (const e of fillsById.get(id) ?? []) {
          if (!e.polygon) continue;
          if (mode === 'off') {
            e.polygon.material = new Cesium.ColorMaterialProperty(HOVER_COLOR.withAlpha(0.0001));
          } else if (mode === 'hover') {
            e.polygon.material = new Cesium.ColorMaterialProperty(HOVER_COLOR.withAlpha(HOVER_FILL_ALPHA));
          } else {
            e.polygon.material = new Cesium.ColorMaterialProperty(
              new Cesium.CallbackProperty(() => HOVER_COLOR.withAlpha(sel.fill), false),
            );
          }
        }
      };

      const modeFor = (id: string): Mode =>
        id === selected ? 'selected' : id === hovered ? 'hover' : 'off';
      const refresh = (id: string | null) => { if (id) applyMode(id, modeFor(id)); };

      const findIdAt = (lon: number, lat: number): string | null => {
        for (const dp of detectPolys) {
          const [minLon, minLat, maxLon, maxLat] = dp.bbox;
          if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
          if (pointInRing(lon, lat, dp.outer) && !dp.holes.some((h) => pointInRing(lon, lat, h))) {
            return dp.id;
          }
        }
        return null;
      };

      const idAtScreen = (pos: Cesium.Cartesian2): string | null => {
        const cart = camera.pickEllipsoid(pos, ell);
        if (!cart) return null;
        const c = Cesium.Cartographic.fromCartesian(cart, ell);
        if (!c) return null;
        return findIdAt(Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude));
      };

      const startPulse = () => {
        cancelAnimationFrame(pulseRaf);
        const t0 = performance.now();
        sel.width = SEL_PEAK.width; sel.glow = SEL_PEAK.glow; sel.fill = SEL_PEAK.fill;
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / PULSE_MS);
          const e = 1 - Math.pow(1 - p, 3);
          sel.width = SEL_PEAK.width + (SEL_REST.width - SEL_PEAK.width) * e;
          sel.glow = SEL_PEAK.glow + (SEL_REST.glow - SEL_PEAK.glow) * e;
          sel.fill = SEL_PEAK.fill + (SEL_REST.fill - SEL_PEAK.fill) * e;
          if (p < 1) pulseRaf = requestAnimationFrame(tick);
        };
        pulseRaf = requestAnimationFrame(tick);
      };

      const homeBounds = interactive.homeBounds ?? null;

      // Zoom out in place: keep the current lon/lat under the camera, just pull
      // the altitude back. (No recentering — stays in front of the country.)
      const DEFAULT_OUT_HEIGHT_M = 12_000_000;
      const flyOut = () => {
        const carto = camera.positionCartographic;
        console.log('[flyOut]');
        camera.flyTo({
          destination: Cesium.Cartesian3.fromRadians(
            carto.longitude,
            carto.latitude,
            homeBounds ? DEFAULT_OUT_HEIGHT_M * 0.6 : DEFAULT_OUT_HEIGHT_M,
          ),
          orientation: {
            heading: camera.heading,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
          duration: 1.2,
        });
      };

      handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
      handler.setInputAction((m: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        if (useLiveStore.getState().mode === 'game') {
          if (hovered) { const old = hovered; hovered = null; refresh(old); scene.canvas.style.cursor = 'default'; }
          return;
        }
        const id = idAtScreen(m.endPosition);
        if (id !== hovered) {
          const old = hovered;
          hovered = id;
          refresh(old);
          refresh(id);
          scene.canvas.style.cursor = id ? 'pointer' : 'default';
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      handler.setInputAction((c: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        if (useLiveStore.getState().mode === 'game') return;
        const id = idAtScreen(c.position);
        if (!id) return;

        // Click the already-selected country → deselect + zoom back out.
        if (id === selected) {
          const prev = selected;
          selected = null;
          refresh(prev);
          useLiveStore.getState().setSelectedCountry(null);
          flyOut();
          return;
        }

        const prev = selected;
        selected = id;
        if (prev && prev !== id) refresh(prev);
        applyMode(id, 'selected');
        startPulse();

        const meta = metaById.get(id);
        if (meta) {
          // Curated mainland box wins over geometry framing for countries whose
          // map parts span overseas territories (France→Guiana, etc.), which
          // otherwise union into an ocean-centered rect.
          const mainland = framingBoundsForIso(meta.iso2);
          if (mainland) {
            const lonPad = ((mainland.maxLon - mainland.minLon) * (COUNTRY_FLY_PADDING - 1)) / 2;
            const latPad = ((mainland.maxLat - mainland.minLat) * (COUNTRY_FLY_PADDING - 1)) / 2;
            camera.flyTo({
              destination: Cesium.Rectangle.fromDegrees(
                mainland.minLon - lonPad,
                mainland.minLat - latPad,
                mainland.maxLon + lonPad,
                mainland.maxLat + latPad,
              ),
              duration: 1.4,
            });
            useLiveStore.getState().setSelectedCountry({ name: meta.label, iso2: meta.iso2 });
            if (meta.slug) interactive.onPick?.(meta.slug);
            return;
          }
          if (rectUntrustworthy(meta.rect, meta.mainCenter)) {
            const spanDeg = Cesium.Math.toDegrees(Math.max(meta.rect.width, meta.rect.height));
            const heightM = Cesium.Math.clamp(spanDeg * 110_000, 2_000_000, 16_000_000);
            console.log('[fly WRAPPED]', meta.label, meta.mainCenter.lon.toFixed(1), meta.mainCenter.lat.toFixed(1), heightM);
            camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(meta.mainCenter.lon, meta.mainCenter.lat, heightM),
              duration: 1.4,
            });
          } else {
            const dest = expandRect(meta.rect, COUNTRY_FLY_PADDING);
            console.log('[fly RECT]', meta.label,
              'W', Cesium.Math.toDegrees(dest.west).toFixed(1),
              'S', Cesium.Math.toDegrees(dest.south).toFixed(1),
              'E', Cesium.Math.toDegrees(dest.east).toFixed(1),
              'N', Cesium.Math.toDegrees(dest.north).toFixed(1));
            camera.flyTo({ destination: dest, duration: 1.4 });
          }
          if (meta.slug) console.log('[onPick]', meta.slug);
          useLiveStore.getState().setSelectedCountry({ name: meta.label, iso2: meta.iso2 });
          if (meta.slug) interactive.onPick?.(meta.slug); // navigation hook (page countries only)
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      // ── External selection sync (deep landing on an SEO page, browser
      //    back/forward, or any programmatic store change) ───────────────────
      const idForIso = (iso2: string | null | undefined): string | null => {
        if (!iso2) return null;
        const want = iso2.toUpperCase();
        for (const [cid, meta] of metaById) if (meta.iso2 === want) return cid;
        return null;
      };

      // If a country is already selected when the borders finish loading
      // (e.g. /fi/ukkostutka deep link), light it up now. Camera framing is
      // handled by initialBounds on cold-land, so we only apply the highlight.
      const initialSel = useLiveStore.getState().selectedCountry;
      let lastSelName = initialSel?.name ?? null;
      if (initialSel?.iso2) {
        const id0 = idForIso(initialSel.iso2);
        if (id0) {
          selected = id0;
          applyMode(id0, 'selected');
          startPulse();
        }
      }

      unsubStore = useLiveStore.subscribe((state) => {
        const cur = state.selectedCountry;
        const curName = cur?.name ?? null;
        if (curName === lastSelName) return;
        lastSelName = curName;

        // Cleared (panel ✕, deselect, back to '/') → unlight + zoom out.
        if (curName === null) {
          if (selected) {
            const prev = selected;
            selected = null;
            refresh(prev);
            flyOut();
          }
          return;
        }

        // Selected via the store rather than a direct click. The click handler
        // already lights up + flies and sets `selected`, so this is a no-op for
        // clicks; here we light up the new country without flying.
        const id = idForIso(cur?.iso2);
        if (id && id !== selected) {
          const prev = selected;
          selected = id;
          if (prev) refresh(prev);
          applyMode(id, 'selected');
          startPulse();
        }
      });
    })
    .catch((err) => {
      console.warn('[globe] could not load /geo/countries.geojson — no borders/labels.', err);
    });

  return () => {
    disposed = true;
    cancelAnimationFrame(pulseRaf);
    if (unsubStore) unsubStore();
    if (handler) handler.destroy();
  };
}