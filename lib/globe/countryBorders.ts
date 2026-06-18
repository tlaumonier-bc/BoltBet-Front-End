// lib/globe/countryBorders.ts
// Crisp vector country borders + screen-space name labels from a Natural Earth
// admin-0 GeoJSON at /public/geo/countries.geojson.
//
// When `interactive` is set, each country is clickable. Borders draw exactly as
// before; we additionally add our own pickable polygon fills (we never add the
// GeoJSON data source to the viewer — that broke rendering). Selection is held
// in liveStore.selectedCountry so the country panel and the country-strikes
// layer react to it:
//   idle    → ~invisible (tiny alpha, still pickable)
//   hover   → faint gray + pointer cursor
//   selected→ stronger gray + outline; camera flies to the country
// Clicking the selected country again (or the panel's close button) deselects.

import * as Cesium from 'cesium';
import {
  COUNTRY_BORDER_COLOR,
  COUNTRY_BORDER_WIDTH,
  COUNTRY_LABEL_COLOR,
  COUNTRY_LABEL_FONT,
  COUNTRY_LABEL_DISTANCE_PER_DEG,
} from './config';
import { flyToBounds, type GlobeBounds } from './camera';
import { useLiveStore } from '@/store/liveStore';

const BORDER_LIFT = 1.0003; // ~2 km

// ── Selection look — tweak freely ────────────────────────────────────────────
const GRAY = '#e2e8f0';
const IDLE_FILL = Cesium.Color.fromCssColorString(GRAY).withAlpha(0.02);
const HOVER_FILL = Cesium.Color.fromCssColorString(GRAY).withAlpha(0.12);
const SELECT_FILL = Cesium.Color.fromCssColorString(GRAY).withAlpha(0.30);
const SELECT_OUTLINE = Cesium.Color.fromCssColorString(GRAY).withAlpha(0.9);
const COUNTRY_FLY_PADDING = 1.3;
const CLICK_DEBOUNCE_MS = 250;

function lift(positions: Cesium.Cartesian3[]): Cesium.Cartesian3[] {
  return positions.map((p) =>
    Cesium.Cartesian3.multiplyByScalar(p, BORDER_LIFT, new Cesium.Cartesian3()),
  );
}

function expandRect(rect: Cesium.Rectangle, factor: number): Cesium.Rectangle {
  const w = (rect.width * (factor - 1)) / 2;
  const h = (rect.height * (factor - 1)) / 2;
  return new Cesium.Rectangle(rect.west - w, rect.south - h, rect.east + w, rect.north + h);
}

function cleanIso(raw: unknown): string | null {
  return typeof raw === 'string' && /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null;
}

interface LoadOptions {
  interactive?: boolean;
  homeBounds?: GlobeBounds | null;
}

export function loadCountryBorders(
  viewer: Cesium.Viewer,
  { interactive = false, homeBounds = null }: LoadOptions = {},
): () => void {
  let destroyed = false;
  let clickHandler: Cesium.ScreenSpaceEventHandler | null = null;
  let hoverHandler: Cesium.ScreenSpaceEventHandler | null = null;
  let clickTimer: ReturnType<typeof setTimeout> | null = null;
  let unsubSel: (() => void) | null = null;

  const scene = viewer.scene;
  const camera = scene.camera;

  Cesium.GeoJsonDataSource.load('/geo/countries.geojson')
    .then((ds) => {
      if (destroyed || viewer.isDestroyed()) return;
      const now = Cesium.JulianDate.now();

      const labels = new Map<string, { center: Cesium.Cartesian3; size: number; spanDeg: number }>();

      const fillToName = new Map<Cesium.Entity, string>();
      const countryFills = new Map<string, Cesium.Entity[]>();
      const countryRect = new Map<string, Cesium.Rectangle>();
      const nameToIso = new Map<string, string | null>();

      let drew = 0;

      for (const entity of ds.entities.values) {
        const hierarchy = entity.polygon?.hierarchy?.getValue(now) as
          | Cesium.PolygonHierarchy
          | undefined;
        if (!hierarchy) continue;

        const rings = [
          hierarchy.positions,
          ...(hierarchy.holes ?? []).map((h) => h.positions),
        ];

        const props = entity.properties as
          | Record<string, { getValue: (t: Cesium.JulianDate) => unknown } | undefined>
          | undefined;
        const name =
          (props?.ADMIN?.getValue(now) as string | undefined) ??
          (props?.NAME?.getValue(now) as string | undefined) ??
          (props?.name?.getValue(now) as string | undefined);
        const iso2 =
          cleanIso(props?.ISO_A2?.getValue(now)) ??
          cleanIso(props?.ISO_A2_EH?.getValue(now)) ??
          cleanIso(props?.iso_a2?.getValue(now));

        // ── Border polylines (identical to the original) ─────────────────────
        for (const positions of rings) {
          if (!positions || positions.length < 2) continue;
          const raised = lift(positions);
          viewer.entities.add({
            polyline: {
              positions: raised.concat([raised[0]]),
              width: COUNTRY_BORDER_WIDTH,
              material: COUNTRY_BORDER_COLOR,
              arcType: Cesium.ArcType.GEODESIC,
            },
          });
          drew++;
        }

        // ── Our own pickable transparent fill ────────────────────────────────
        if (interactive && name) {
          const fill = viewer.entities.add({
            polygon: {
              hierarchy,
              material: new Cesium.ColorMaterialProperty(IDLE_FILL),
              height: 0,
              outline: false,
              outlineColor: SELECT_OUTLINE,
            },
          });
          fillToName.set(fill, name);
          const list = countryFills.get(name) ?? [];
          list.push(fill);
          countryFills.set(name, list);
          if (!nameToIso.has(name)) nameToIso.set(name, iso2 ?? null);

          const main = rings.reduce((a, b) => (b.length > a.length ? b : a));
          const rect = Cesium.Rectangle.fromCartesianArray(main);
          const prevRect = countryRect.get(name);
          countryRect.set(name, prevRect ? Cesium.Rectangle.union(prevRect, rect) : rect);
        }

        // ── Label bookkeeping (unchanged) ────────────────────────────────────
        if (!name) continue;
        const main = rings.reduce((a, b) => (b.length > a.length ? b : a));
        const rect = Cesium.Rectangle.fromCartesianArray(main);
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

        const prev = labels.get(name);
        if (!prev || main.length > prev.size) labels.set(name, { center, size: main.length, spanDeg });
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

      let hovered: string | null = null;

      const paint = (name: string, color: Cesium.Color, outlineOn: boolean) => {
        for (const ent of countryFills.get(name) ?? []) {
          if (!ent.polygon) continue;
          ent.polygon.material = new Cesium.ColorMaterialProperty(color);
          ent.polygon.outline = new Cesium.ConstantProperty(outlineOn);
        }
      };

      const selName = () => useLiveStore.getState().selectedCountry?.name ?? null;

      // Repaint a country to whatever state it should currently be in.
      const repaint = (name: string | null) => {
        if (!name) return;
        if (name === selName()) { paint(name, SELECT_FILL, true); return; }
        if (name === hovered) { paint(name, HOVER_FILL, false); return; }
        paint(name, IDLE_FILL, false);
      };

      const setHover = (name: string | null) => {
        if (name === hovered) return;
        const prev = hovered;
        hovered = name;
        if (prev) repaint(prev);
        if (name) repaint(name);
        scene.canvas.style.cursor = name ? 'pointer' : 'default';
      };

      // Selection is the store's job; we react to it (paint + fly).
      let lastSel = selName();
      unsubSel = useLiveStore.subscribe((state) => {
        const cur = state.selectedCountry?.name ?? null;
        if (cur === lastSel) return;
        const prev = lastSel;
        lastSel = cur;
        if (prev) repaint(prev);
        if (cur) {
          paint(cur, SELECT_FILL, true);
          const rect = countryRect.get(cur);
          if (rect) camera.flyTo({ destination: expandRect(rect, COUNTRY_FLY_PADDING), duration: 1.4 });
        } else {
          flyToBounds(camera, homeBounds, 1.2);
        }
      });

      const countryAt = (pos: Cesium.Cartesian2): string | null => {
        const picks = scene.drillPick(pos, 6);
        for (const p of picks) {
          const id = (p as { id?: unknown })?.id;
          if (id instanceof Cesium.Entity && fillToName.has(id)) return fillToName.get(id)!;
        }
        return null;
      };

      hoverHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
      hoverHandler.setInputAction((m: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        setHover(countryAt(m.endPosition));
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      clickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
      clickHandler.setInputAction((c: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
          return; // second click of a double-click → let zoom run, no toggle
        }
        const pos = c.position.clone();
        clickTimer = setTimeout(() => {
          clickTimer = null;
          const name = countryAt(pos);
          if (!name) return; // ocean/space — keep current selection
          const store = useLiveStore.getState();
          if (store.selectedCountry?.name === name) {
            store.setSelectedCountry(null);
          } else {
            store.setSelectedCountry({ name, iso2: nameToIso.get(name) ?? null });
          }
        }, CLICK_DEBOUNCE_MS);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    })
    .catch((err) => {
      console.warn('[globe] could not load /geo/countries.geojson — no borders/labels.', err);
    });

  return () => {
    destroyed = true;
    if (clickTimer) clearTimeout(clickTimer);
    if (unsubSel) unsubSel();
    if (clickHandler && !clickHandler.isDestroyed()) clickHandler.destroy();
    if (hoverHandler && !hoverHandler.isDestroyed()) hoverHandler.destroy();
  };
}