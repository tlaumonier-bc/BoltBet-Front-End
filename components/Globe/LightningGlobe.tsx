'use client';

import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useGameStore } from '@/store/gameStore';
import { useLiveStore } from '@/store/liveStore';
import { buildInitialCells, cellCenter, cellColor, regionName } from '@/lib/grid';
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

const STORM_BG = Cesium.Color.fromCssColorString('#04060d');
const GRID_GRAY = Cesium.Color.fromCssColorString('#94a3b8');

interface LightningGlobeProps {
  viewOnly?: boolean;
  fill?: boolean;
  enableZoom?: boolean;
  showZoomButtons?: boolean;
  /** Gentle auto-spin until the user interacts. Defaults to on for view-only pages. */
  autoRotate?: boolean;
  /** If set, the camera frames this lon/lat box on load (used by country pages). */
  initialBounds?: { minLon: number; minLat: number; maxLon: number; maxLat: number };
}

export default function LightningGlobe({
  viewOnly = false,
  fill = false,
  enableZoom = true,
  showZoomButtons = false,
  autoRotate,
  initialBounds,
}: LightningGlobeProps) {
  useLightningSocket();

  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomInRef = useRef<() => void>(() => {});
  const zoomOutRef = useRef<() => void>(() => {});
  const [tilesLoading, setTilesLoading] = useState(false);

  const spin = autoRotate ?? (viewOnly && !initialBounds);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

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

    // Show a loading overlay while higher-res tiles stream in on zoom.
    // Debounced both ways so quick loads don't flash and brief gaps don't flicker.
    let destroyed = false;
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const onTileProgress = (queued: number) => {
      if (destroyed) return;
      if (queued > 0) {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (!showTimer) showTimer = setTimeout(() => { setTilesLoading(true); showTimer = null; }, 150);
      } else {
        if (showTimer) { clearTimeout(showTimer); showTimer = null; }
        if (!hideTimer) hideTimer = setTimeout(() => { setTilesLoading(false); hideTimer = null; }, 300);
      }
    };
    scene.globe.tileLoadProgressEvent.addEventListener(onTileProgress);

    // ---- imagery: NASA "Black Marble" night lights, tiled via GIBS ----
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
        maximumLevel: 8,
        credit: 'NASA EOSDIS GIBS — VIIRS Black Marble',
      })
    );

    // ---- look & feel: match the app's dark "storm" aesthetic + blue rim glow ----
    scene.backgroundColor = STORM_BG;
    if (scene.skyBox) scene.skyBox.show = false;
    if (scene.sun) scene.sun.show = false;
    if (scene.moon) scene.moon.show = false;

    // Outer blue halo around the limb.
    if (scene.skyAtmosphere) {
      scene.skyAtmosphere.show = true;
      scene.skyAtmosphere.atmosphereLightIntensity = 20;
      scene.skyAtmosphere.brightnessShift = 0.4;
      scene.skyAtmosphere.saturationShift = 0.1;
      scene.skyAtmosphere.perFragmentAtmosphere = true;
    }

    // Ground atmosphere: STATIC lighting (relative to the camera, not the real
    // sun) so the rim glows evenly no matter the time of day.
    scene.globe.showGroundAtmosphere = true;
    scene.globe.dynamicAtmosphereLighting = false;
    scene.globe.dynamicAtmosphereLightingFromSun = false;
    scene.globe.atmosphereBrightnessShift = 0.4;
    scene.globe.enableLighting = false; // city lights shown uniformly, no terminator
    scene.globe.baseColor = STORM_BG;
    scene.fog.enabled = true;

    if (initialBounds) {
      camera.setView({
        destination: Cesium.Rectangle.fromDegrees(
          initialBounds.minLon,
          initialBounds.minLat,
          initialBounds.maxLon,
          initialBounds.maxLat,
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

    // ---- betting grid (play mode only) ----
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

    if (!viewOnly) {
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

    return () => {
      destroyed = true;
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
      scene.globe.tileLoadProgressEvent.removeEventListener(onTileProgress);
      if (onWheelCapture) el.removeEventListener('wheel', onWheelCapture, { capture: true });
      if (onDblClick) el.removeEventListener('dblclick', onDblClick);
      interactionEvents.forEach((ev) => el.removeEventListener(ev, stopSpin));
      pickHandler?.destroy();
      unsubCells?.();
      unsubOrbit?.();
      disposeStrikes();
      if (!viewer.isDestroyed()) viewer.destroy();
    };
  }, [
    viewOnly,
    enableZoom,
    showZoomButtons,
    spin,
    initialBounds?.minLon,
    initialBounds?.minLat,
    initialBounds?.maxLon,
    initialBounds?.maxLat,
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