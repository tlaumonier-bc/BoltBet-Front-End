'use client';

import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useGameStore } from '@/store/gameStore';
import { useLiveStore } from '@/store/liveStore';
import { usePlayStore } from '@/store/playStore';
import { buildInitialCells, cellCenter, cellColor, regionName } from '@/lib/grid';
import { zoneFor, zoneBounds, allZones } from '@/lib/zones';
import { attachLightningStrikes } from '@/lib/globe/lightningStrikes';
import { useLightningSocket } from '@/lib/socket';
import type { GridCell } from '@/types';

// Tell Cesium where its static assets live (copied to /public/cesium).
if (typeof window !== 'undefined') {
  (window as unknown as { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = '/cesium';
}
// Optional: set this env var to use Cesium Ion satellite imagery instead of CARTO.
const ION_TOKEN = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
if (ION_TOKEN) Cesium.Ion.defaultAccessToken = ION_TOKEN;

const FLY_HEIGHT_M = 2_500_000;

// SEO/country framing zoom. 1 = frame the country box exactly; higher = more
// zoomed out (more context around the country).
const SEO_ZOOM_PADDING = 1.8;

const STORM_BG = Cesium.Color.fromCssColorString('#04060d');
const GRID_GRAY = Cesium.Color.fromCssColorString('#94a3b8');
const LOCK_COLOR = Cesium.Color.fromCssColorString('#38bdf8'); // electric — game lock highlight

// Vector country borders (crisp at every zoom, unlike raster labels).
const COUNTRY_BORDER_COLOR = Cesium.Color.fromCssColorString('#94a3b8').withAlpha(0.55); // modern gray
const COUNTRY_BORDER_WIDTH = 1.2;

interface LightningGlobeProps {
  viewOnly?: boolean;
  fill?: boolean;
  enableZoom?: boolean;
  showZoomButtons?: boolean;
  /** Gentle auto-spin until the user interacts. Defaults to on for view-only pages. */
  autoRotate?: boolean;
  /** If set, the camera frames this lon/lat box on load (used by country pages). */
  initialBounds?: { minLon: number; minLat: number; maxLon: number; maxLat: number };
  /** Fired once the first tiles are in — drives GlobeWrapper's loader. */
  onReady?: () => void;
  /** New round-based game: clicking a zone fires onPickZone; the player's locked
   *  zone (from the play store) is highlighted. */
  gameMode?: boolean;
  onPickZone?: (zoneId: string) => void;
  /** Accepted for API compatibility; the lock highlight is driven by the play store. */
  lockedZoneId?: string | null;
}

export default function LightningGlobe({
  viewOnly = false,
  fill = false,
  enableZoom = true,
  showZoomButtons = false,
  autoRotate,
  initialBounds,
  onReady,
  gameMode = false,
  onPickZone,
}: LightningGlobeProps) {
  useLightningSocket();

  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomInRef = useRef<() => void>(() => {});
  const zoomOutRef = useRef<() => void>(() => {});
  const [tilesLoading, setTilesLoading] = useState(false);

  // Keep the latest onReady in a ref so the main effect can call it without
  // listing it as a dependency (which would tear down/rebuild the viewer).
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Same trick for the pick callback, so changing it never rebuilds the viewer.
  const onPickRef = useRef(onPickZone);
  useEffect(() => {
    onPickRef.current = onPickZone;
  }, [onPickZone]);

  // Pull initialBounds into primitives so the effect's dep array is stable
  // and lint-correct (referencing the object directly would force a rebuild
  // on every new object reference).
  const boundsMinLon = initialBounds?.minLon;
  const boundsMinLat = initialBounds?.minLat;
  const boundsMaxLon = initialBounds?.maxLon;
  const boundsMaxLat = initialBounds?.maxLat;

  const spin = autoRotate ?? (viewOnly && !initialBounds);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setTilesLoading(false);

    // When globe zoom is disabled (landing page + embedded country maps), let
    // wheel events scroll the page. Cesium otherwise swallows the wheel on its
    // canvas, so we intercept it on the container in the CAPTURE phase before it
    // reaches Cesium — and we do NOT preventDefault, so the browser scrolls.
    let onWheelCapture: ((e: Event) => void) | null = null;
    if (!enableZoom) {
      onWheelCapture = (e) => e.stopPropagation();
      el.addEventListener('wheel', onWheelCapture, { capture: true, passive: true });
    }

    const viewer = new Cesium.Viewer(el, {
      baseLayer: false, // we add our own imagery — no Ion token required
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
    });

    const { scene, camera } = viewer;

    // ── Loading states ───────────────────────────────────────────────
    //  1. onReady()        → fired once, when the first tiles are in. Tells
    //     GlobeWrapper to fade out its full-screen loader.
    //  2. tilesLoading=true → the small "Loading map detail…" pill, only
    //     AFTER the first load, while higher-res tiles stream in on zoom.
    let destroyed = false;
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let sawInitialTiles = false;
    let initialReady = false;

    const revealGlobe = () => {
      if (initialReady) return;
      initialReady = true;
      if (!destroyed) onReadyRef.current?.();
    };

    // Safety net: never leave the loader stuck (e.g. if imagery tiles fail
    // to load) — reveal the globe after a few seconds no matter what.
    const readyFallback = setTimeout(revealGlobe, 8000);

    const onTileProgress = (queued: number) => {
      if (destroyed) return;

      // (1) initial load: wait until tiles have actually started loading
      // (queued > 0) and then drained to 0 → first frame is fully tiled.
      if (!initialReady) {
        if (queued > 0) sawInitialTiles = true;
        if (sawInitialTiles && queued === 0) revealGlobe();
        return; // don't drive the detail pill during the first load
      }

      // (2) subsequent zoom/scroll: the small detail loader (debounced).
      if (queued > 0) {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (!showTimer) showTimer = setTimeout(() => { setTilesLoading(true); showTimer = null; }, 150);
      } else {
        if (showTimer) { clearTimeout(showTimer); showTimer = null; }
        if (!hideTimer) hideTimer = setTimeout(() => { setTilesLoading(false); hideTimer = null; }, 300);
      }
    };
    scene.globe.tileLoadProgressEvent.addEventListener(onTileProgress);

    // ---- base imagery: night (Black Marble) + day (Blue Marble), toggled via the HUD ----
    const nightLayer = viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
        maximumLevel: 8,
        credit: 'NASA EOSDIS GIBS — VIIRS Black Marble',
      })
    );
    const dayLayer = viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
        maximumLevel: 8,
        credit: 'NASA EOSDIS GIBS — Blue Marble',
      })
    );

    // ---- borders + place-name labels: transparent overlay, stays on top ----
    const labelsLayer = viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png',
        subdomains: ['a', 'b', 'c', 'd'],
        maximumLevel: 30, // was 10 — let names stay sharp when zoomed in
        credit: '© OpenStreetMap contributors © CARTO',
      })
    );
    labelsLayer.alpha = 0.85;

    // ---- crisp vector country borders (Natural Earth GeoJSON in /public) ----
    // Raster labels blur when zoomed; vector borders stay sharp at every zoom.
    // Drop a countries file at public/geo/countries.geojson (Natural Earth 110m
    // admin-0). The loader no-ops if the file is missing, so nothing breaks.
    Cesium.GeoJsonDataSource.load('/geo/countries.geojson')
      .then((ds) => {
        if (destroyed) return;
        const now = Cesium.JulianDate.now();
        for (const entity of ds.entities.values) {
          const hierarchy = entity.polygon?.hierarchy?.getValue(now);
          if (!hierarchy) continue;
          const rings = [
            hierarchy.positions,
            ...(hierarchy.holes ?? []).map((h) => h.positions),
          ];
          for (const positions of rings) {
            if (!positions || positions.length < 2) continue;
            viewer.entities.add({
              polyline: {
                positions: positions.concat([positions[0]]), // close the ring
                width: COUNTRY_BORDER_WIDTH,
                material: COUNTRY_BORDER_COLOR,
                clampToGround: true,
              },
            });
          }
        }
      })
      .catch(() => {
        /* no GeoJSON yet → just no borders */
      });

    // initial style from the store (night is the default), then keep it in sync.
    const applyMapStyle = (style: 'night' | 'day') => {
      nightLayer.show = style === 'night';
      dayLayer.show = style === 'day';
    };
    applyMapStyle(useLiveStore.getState().mapStyle);
    const unsubMapStyle = useLiveStore.subscribe((state) => applyMapStyle(state.mapStyle));

    // ---- look & feel: match the app's dark "storm" aesthetic + blue rim glow ----
    scene.backgroundColor = STORM_BG;
    if (scene.skyBox) scene.skyBox.show = false;
    if (scene.sun) scene.sun.show = false;
    if (scene.moon) scene.moon.show = false;

    // Outer blue halo around the limb — kept dim/transparent so the night
    // imagery stays readable, and a bit taller so strike beams begin inside it.
    if (scene.skyAtmosphere) {
      scene.skyAtmosphere.show = true;
      scene.skyAtmosphere.atmosphereLightIntensity = 8;   // was 20 — dimmer / more transparent
      scene.skyAtmosphere.brightnessShift = 0.0;          // was 0.4
      scene.skyAtmosphere.saturationShift = 0.0;          // was 0.1
      scene.skyAtmosphere.perFragmentAtmosphere = true;
      scene.skyAtmosphere.atmosphereRayleighScaleHeight = 18_000; // taller, softer band
      scene.skyAtmosphere.atmosphereMieScaleHeight = 6_000;
    }

    // Ground atmosphere: STATIC lighting (relative to the camera, not the real
    // sun) so the rim glows evenly no matter the time of day.
    scene.globe.showGroundAtmosphere = true;
    scene.globe.dynamicAtmosphereLighting = false;
    scene.globe.dynamicAtmosphereLightingFromSun = false;
    scene.globe.atmosphereBrightnessShift = -0.1; // was 0.4 — let night imagery show through
    scene.globe.enableLighting = false; // city lights shown uniformly, no terminator
    scene.globe.baseColor = STORM_BG;
    scene.fog.enabled = true;

    // ---- bloom: blooms bright pixels, so the rim reads as atmosphere and the
    // lightning strikes glow against the dark globe. Tune to taste. ----
    if (scene.postProcessStages?.bloom) {
      const bloom = scene.postProcessStages.bloom;
      bloom.enabled = true;
      bloom.uniforms.glowOnly = false;
      bloom.uniforms.contrast = 120;
      bloom.uniforms.brightness = -0.2;
      bloom.uniforms.delta = 1.2;
      bloom.uniforms.sigma = 2.5;
      bloom.uniforms.stepSize = 1.0;
    }
    scene.highDynamicRange = false; // HDR over-brightened the night side / atmosphere

    if (
      boundsMinLon != null &&
      boundsMinLat != null &&
      boundsMaxLon != null &&
      boundsMaxLat != null
    ) {
      // Pad the country box so the framing isn't glued to the borders.
      const lonPad = ((boundsMaxLon - boundsMinLon) * (SEO_ZOOM_PADDING - 1)) / 2;
      const latPad = ((boundsMaxLat - boundsMinLat) * (SEO_ZOOM_PADDING - 1)) / 2;
      camera.setView({
        destination: Cesium.Rectangle.fromDegrees(
          boundsMinLon - lonPad,
          boundsMinLat - latPad,
          boundsMaxLon + lonPad,
          boundsMaxLat + latPad,
        ),
      });
    } else {
      camera.setView({ destination: Cesium.Cartesian3.fromDegrees(0, 20, 20_000_000) });
    }
    camera.constrainedAxis = Cesium.Cartesian3.UNIT_Z; // keeps the globe level + clean spin

    // ---- camera controls / zoom range ----
    const ctrl = scene.screenSpaceCameraController;
    ctrl.enableZoom = enableZoom;
    ctrl.minimumZoomDistance = 50_000; // ~50 km: zoom in to country / region level
    ctrl.maximumZoomDistance = 30_000_000;

    const zoomStep = () => Math.max(camera.positionCartographic.height * 0.3, 50_000);
    zoomInRef.current = () => camera.zoomIn(zoomStep());
    zoomOutRef.current = () => camera.zoomOut(zoomStep());

    // double-click to zoom in (only where the +/- buttons are shown)
    let onDblClick: (() => void) | null = null;
    if (showZoomButtons) {
      viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
        Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
      );
      onDblClick = () => zoomInRef.current();
      el.addEventListener('dblclick', onDblClick);
    }

    // ---- auto-rotate until the user interacts ----
    let interacted = false;
    const stopSpin = () => {
      interacted = true;
    };
    const interactionEvents = ['mousedown', 'touchstart', 'wheel', 'pointerdown'];
    interactionEvents.forEach((ev) => el.addEventListener(ev, stopSpin, { passive: true }));
    const onSpin = () => {
      if (spin && !interacted) camera.rotateRight(0.0006);
    };
    if (spin) scene.preRender.addEventListener(onSpin);

    // ---- live lightning strikes (shared module) ----
    const disposeStrikes = attachLightningStrikes(scene);

    // ---- legacy multiplier betting grid (only the old play mode) ----
    const cellEntities = new Map<string, Cesium.Entity>();
    const cellBase = new Map<string, Cesium.Color>();
    let pickHandler: Cesium.ScreenSpaceEventHandler | null = null;
    let unsubCells: (() => void) | null = null;

    const setHover = (cellId: string | null, on: boolean) => {
      if (!cellId) return;
      const ent = cellEntities.get(cellId);
      const base = cellBase.get(cellId);
      if (!ent || !ent.rectangle || !base) return;
      ent.rectangle.material = new Cesium.ColorMaterialProperty(base.withAlpha(on ? 0.16 : 0.0));
      ent.rectangle.outlineColor = new Cesium.ConstantProperty(
        GRID_GRAY.withAlpha(on ? 0.6 : 0.22)
      );
    };

    const syncCells = (cells: Record<string, GridCell>) => {
      for (const cell of Object.values(cells)) {
        const center = cellCenter(cell.lonMin, cell.latMin);
        const { color } = cellColor(cell.multiplier);
        const base = Cesium.Color.fromCssColorString(color);
        cellBase.set(cell.id, base);
        let ent = cellEntities.get(cell.id);
        if (!ent) {
          ent = viewer.entities.add({
            id: `cell_${cell.id}`,
            position: Cesium.Cartesian3.fromDegrees(center.lon, center.lat),
            rectangle: {
              coordinates: Cesium.Rectangle.fromDegrees(
                cell.lonMin,
                cell.latMin,
                cell.lonMin + 20,
                cell.latMin + 20
              ),
              material: new Cesium.ColorMaterialProperty(base.withAlpha(0.0)),
              height: 0,
              outline: true,
              outlineColor: GRID_GRAY.withAlpha(0.22),
            },
            label: {
              text: `${cell.multiplier.toFixed(1)}x`,
              font: '600 13px sans-serif',
              fillColor: GRID_GRAY.withAlpha(0.55),
              showBackground: false,
              disableDepthTestDistance: 0, // hidden when on the far side of the globe
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
            },
          });
          cellEntities.set(cell.id, ent);
        } else if (ent.label) {
          ent.label.text = new Cesium.ConstantProperty(`${cell.multiplier.toFixed(1)}x`);
        }
      }
    };

    if (!viewOnly && !gameMode) {
      if (Object.keys(useGameStore.getState().cells).length === 0) {
        useGameStore.getState().setCells(buildInitialCells());
      }
      syncCells(useGameStore.getState().cells);

      // keep labels/colours in sync with websocket multiplier updates
      let prevCells = useGameStore.getState().cells;
      unsubCells = useGameStore.subscribe((state) => {
        if (state.cells !== prevCells) {
          prevCells = state.cells;
          syncCells(state.cells);
        }
      });

      // hover + click picking
      pickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
      let hoveredId: string | null = null;

      const pickedCellId = (pos: Cesium.Cartesian2): string | null => {
        const picked = scene.pick(pos) as { id?: { id?: unknown } } | undefined;
        const id = picked?.id?.id;
        return typeof id === 'string' && id.startsWith('cell_') ? id.slice(5) : null;
      };

      pickHandler.setInputAction((m: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        const cellId = pickedCellId(m.endPosition);
        if (cellId !== hoveredId) {
          setHover(hoveredId, false);
          hoveredId = cellId;
          setHover(hoveredId, true);
          scene.canvas.style.cursor = cellId ? 'pointer' : 'default';
        }
        const tip = tooltipRef.current;
        if (cellId && tip) {
          const cell = useGameStore.getState().cells[cellId];
          const c = cellCenter(cell.lonMin, cell.latMin);
          tip.style.display = 'block';
          tip.style.left = `${m.endPosition.x}px`;
          tip.style.top = `${m.endPosition.y}px`;
          tip.innerHTML =
            `<div style="font-weight:600">${regionName(c.lat, c.lon)}</div>` +
            `<div style="opacity:.7">${cell.multiplier.toFixed(1)}x multiplier</div>` +
            `<div style="opacity:.5">${cell.strikeCount24h} strikes / 24h · ${cell.activeBets} bets</div>`;
        } else if (tip) {
          tip.style.display = 'none';
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

      pickHandler.setInputAction((c: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        const cellId = pickedCellId(c.position);
        if (cellId) useGameStore.getState().selectCell(cellId);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    // ---- "orbit to" camera flights (driven by the /live HUD) ----
    let unsubOrbit: (() => void) | null = null;
    if (viewOnly) {
      let lastReq = 0;
      unsubOrbit = useLiveStore.subscribe((state) => {
        const t = state.orbitTarget;
        if (t && t.requestedAt !== lastReq) {
          lastReq = t.requestedAt;
          interacted = true; // stop the spin so it doesn't fight the flight
          camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(t.lon, t.lat, FLY_HEIGHT_M),
            duration: 1.6,
          });
        }
      });
    }

    // ---- round-based game: click a zone to pick it; highlight the locked zone ----
    let gameHandler: Cesium.ScreenSpaceEventHandler | null = null;
    let unsubLock: (() => void) | null = null;
    let highlight: Cesium.Entity | null = null;

    if (gameMode) {
      // (a) the 648-zone grid as faint gray borders, so the layer is visible
      for (const z of allZones()) {
        viewer.entities.add({
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(z.lonMin, z.latMin, z.lonMax, z.latMax),
            material: Cesium.Color.TRANSPARENT,
            height: 0,
            outline: true,
            outlineColor: GRID_GRAY.withAlpha(0.18),
          },
        });
      }

      // (b) hovered-zone highlight
      let hoverEnt: Cesium.Entity | null = null;
      let hoverZone: string | null = null;
      const showHover = (zoneId: string | null) => {
        if (zoneId === hoverZone) return;
        hoverZone = zoneId;
        scene.canvas.style.cursor = zoneId ? 'pointer' : 'default';
        if (!zoneId) {
          if (hoverEnt) {
            viewer.entities.remove(hoverEnt);
            hoverEnt = null;
          }
          return;
        }
        const b = zoneBounds(zoneId);
        const coords = Cesium.Rectangle.fromDegrees(b.lonMin, b.latMin, b.lonMax, b.latMax);
        if (!hoverEnt) {
          hoverEnt = viewer.entities.add({
            rectangle: {
              coordinates: coords,
              material: new Cesium.ColorMaterialProperty(GRID_GRAY.withAlpha(0.12)),
              height: 0,
              outline: true,
              outlineColor: GRID_GRAY.withAlpha(0.5),
            },
          });
        } else if (hoverEnt.rectangle) {
          hoverEnt.rectangle.coordinates = new Cesium.ConstantProperty(coords);
        }
      };

      // (c) locked-zone highlight, driven by the play store (clears when the lock expires)
      const applyLock = (zoneId: string | null) => {
        if (highlight) {
          viewer.entities.remove(highlight);
          highlight = null;
        }
        if (!zoneId) return;
        const b = zoneBounds(zoneId);
        highlight = viewer.entities.add({
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(b.lonMin, b.latMin, b.lonMax, b.latMax),
            material: new Cesium.ColorMaterialProperty(LOCK_COLOR.withAlpha(0.22)),
            height: 0,
            outline: true,
            outlineColor: LOCK_COLOR.withAlpha(0.9),
          },
        });
      };

      let lastLock = usePlayStore.getState().lockZoneId;
      applyLock(lastLock);
      unsubLock = usePlayStore.subscribe((state) => {
        if (state.lockZoneId !== lastLock) {
          lastLock = state.lockZoneId;
          applyLock(lastLock);
        }
      });

      // (d) hover + click-to-pick (zone resolved from the surface point)
      const zoneAt = (pos: Cesium.Cartesian2): string | null => {
        const cartesian = camera.pickEllipsoid(pos, scene.globe.ellipsoid);
        if (!cartesian) return null;
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        return zoneFor(
          Cesium.Math.toDegrees(carto.latitude),
          Cesium.Math.toDegrees(carto.longitude),
        );
      };

      gameHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
      gameHandler.setInputAction((m: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        showHover(zoneAt(m.endPosition));
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      gameHandler.setInputAction((c: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        const zid = zoneAt(c.position);
        if (zid) onPickRef.current?.(zid);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    return () => {
      destroyed = true;
      clearTimeout(readyFallback);
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
      scene.globe.tileLoadProgressEvent.removeEventListener(onTileProgress);
      if (onWheelCapture) el.removeEventListener('wheel', onWheelCapture, { capture: true });
      if (onDblClick) el.removeEventListener('dblclick', onDblClick);
      interactionEvents.forEach((ev) => el.removeEventListener(ev, stopSpin));
      pickHandler?.destroy();
      gameHandler?.destroy();
      unsubCells?.();
      unsubOrbit?.();
      unsubLock?.();
      unsubMapStyle();
      disposeStrikes();
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, [
    viewOnly,
    enableZoom,
    showZoomButtons,
    spin,
    gameMode,
    boundsMinLon,
    boundsMinLat,
    boundsMaxLon,
    boundsMaxLat,
  ]);

  return (
    <div className={fill ? 'absolute inset-0' : 'fixed inset-0 bg-black'}>
      <div ref={containerRef} className="cesium-globe h-full w-full" />

      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-20 hidden -translate-x-1/2 translate-y-[-115%] whitespace-nowrap rounded-md border border-white/15 bg-black/80 px-3 py-2 text-xs text-white shadow-lg backdrop-blur"
        style={{ display: 'none' }}
      />

      <div
        className={`pointer-events-none absolute left-1/2 top-20 z-30 -translate-x-1/2 transition-opacity duration-300 ${
          tilesLoading ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="glass flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-white/80">
          <span className="globe-loading-spinner" />
          Loading map detail…
        </div>
      </div>

      {showZoomButtons && (
        <div
          className="absolute bottom-6 right-6 z-20 flex flex-col gap-2"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => zoomInRef.current()}
            aria-label="Zoom in"
            className="glass flex h-11 w-11 items-center justify-center rounded-xl text-2xl leading-none text-white/90 transition hover:bg-white/15 active:scale-95"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomOutRef.current()}
            aria-label="Zoom out"
            className="glass flex h-11 w-11 items-center justify-center rounded-xl text-2xl leading-none text-white/90 transition hover:bg-white/15 active:scale-95"
          >
            −
          </button>
        </div>
      )}
    </div>
  );
}
