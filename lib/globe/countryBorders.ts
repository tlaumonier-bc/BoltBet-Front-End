// lib/globe/countryBorders.ts
// Crisp vector country borders + screen-space name labels from a Natural Earth
// admin-0 GeoJSON at /public/geo/countries.geojson.
// When `interactive` is provided, EVERY country becomes interactive:
//   • hover  -> a subtle glowing border (invites a click)
//   • click  -> a stronger, pulsing "light up" that stays on, + an orbit fly-in.
// Countries that have a page (a CountryLink) also expose their slug via onPick
// for future navigation; the rest simply orbit on click.
// Detection is geometric (point-under-cursor inside the polygon), so the whole
// country area reacts instantly.

import * as Cesium from 'cesium';
import { useLiveStore } from '@/store/liveStore';
import {
  COUNTRY_BORDER_COLOR,
  COUNTRY_BORDER_WIDTH,
  COUNTRY_LABEL_COLOR,
  COUNTRY_LABEL_FONT,
  COUNTRY_LABEL_DISTANCE_PER_DEG,
} from './config';

const BORDER_LIFT = 1.0003;

const HOVER_COLOR = Cesium.Color.fromCssColorString('#38bdf8');
const HOVER_WIDTH = 3.0;
const HOVER_GLOW = 0.3;
const HOVER_FILL_ALPHA = 0.12;
const SEL_REST = { width: 4.0, glow: 0.5, fill: 0.18 };
const SEL_PEAK = { width: 7.0, glow: 1.0, fill: 0.42 };
const PULSE_MS = 700;

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
}

interface DetectPoly {
  id: string;
  outer: number[][]; // [ [lon,lat], ... ]
  holes: number[][][];
  bbox: [number, number, number, number]; // minLon, minLat, maxLon, maxLat
}

interface CountryMeta {
  slug?: string; // present only for countries that have a page
  center: { lat: number; lon: number };
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
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
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
  let pulseRaf = 0;
  let disposed = false;

  Cesium.GeoJsonDataSource.load('/geo/countries.geojson')
    .then((ds) => {
      if (disposed || viewer.isDestroyed()) return;
      const scene = viewer.scene;
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
          const prev = metaById.get(id);
          if (!prev || main.length > prev.size) {
            metaById.set(id, {
              slug: link?.slug,
              center: link?.center ?? geoCenter,
              label: link?.label ?? name ?? id,
              size: main.length,
            });
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
        const cart = scene.camera.pickEllipsoid(pos, ell);
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

      handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

      handler.setInputAction((m: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
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
        const id = idAtScreen(c.position);
        if (!id) return;
        const prev = selected;
        selected = id;
        if (prev && prev !== id) refresh(prev);
        applyMode(id, 'selected');
        startPulse();
        const meta = metaById.get(id);
        if (meta) {
          useLiveStore.getState().orbitTo({
            id,
            label: meta.label,
            lat: meta.center.lat,
            lon: meta.center.lon,
          });
          if (meta.slug) interactive.onPick?.(meta.slug); // navigation hook (page countries only)
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    })
    .catch((err) => {
      console.warn('[globe] could not load /geo/countries.geojson — no borders/labels.', err);
    });

  return () => {
    disposed = true;
    cancelAnimationFrame(pulseRaf);
    if (handler) handler.destroy();
  };
}