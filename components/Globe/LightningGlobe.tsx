'use client';

import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import { useLightningSocket } from '@/lib/socket';
import { useLiveStore } from '@/store/liveStore';
import { QUALITY_PRESETS, type GlobeQuality } from '@/lib/globe/quality';
import { attachLightningStrikes } from '@/lib/globe/lightningStrikes';
import { setupImagery } from '@/lib/globe/imagery';
import { configureScene } from '@/lib/globe/scene';
import { createTileLoadTracker } from '@/lib/globe/tileLoadTracker';
import { loadCountryBorders, type CountryLink } from '@/lib/globe/countryBorders';
import {
  attachOrbitFlights,
  frameCamera,
  setupAutoRotate,
  setupCameraControls,
  setupWheelPassthrough,
  type InteractionState,
} from '@/lib/globe/camera';
import { attachBettingGrid } from '@/lib/globe/bettingGrid';
import { attachGameZones } from '@/lib/globe/gameZones';
import { GlobeTooltip, GlobeZoomButtons, TileLoadingPill } from './GlobeOverlays';
import { attachAtmosphereGlow } from '@/lib/globe/atmosphereGlow';
import { attachLayers } from '@/lib/globe/layerManager';
import { attachCountryStrikes } from '@/lib/globe/countryStrikesLayer';


interface LightningGlobeProps {
  viewOnly?: boolean;
  fill?: boolean;
  enableZoom?: boolean;
  showZoomButtons?: boolean;
  autoRotate?: boolean;
  initialBounds?: { minLon: number; minLat: number; maxLon: number; maxLat: number };
  onReady?: () => void;
  gameMode?: boolean;
  onPickZone?: (zoneId: string) => void;
  lockedZoneId?: string | null;
  countryLinks?: CountryLink[];
  onPickCountry?: (slug: string) => void;
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
  countryLinks,
  onPickCountry,
}: LightningGlobeProps) {
  useLightningSocket();

  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomInRef = useRef<() => void>(() => {});
  const zoomOutRef = useRef<() => void>(() => {});
  const [tilesLoading, setTilesLoading] = useState(false);

  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  const onPickRef = useRef(onPickZone);
  useEffect(() => { onPickRef.current = onPickZone; }, [onPickZone]);
  const onPickCountryRef = useRef(onPickCountry);
  useEffect(() => { onPickCountryRef.current = onPickCountry; }, [onPickCountry]);
  const linksRef = useRef(countryLinks);
  useEffect(() => { linksRef.current = countryLinks; }, [countryLinks]);

  const boundsMinLon = initialBounds?.minLon;
  const boundsMinLat = initialBounds?.minLat;
  const boundsMaxLon = initialBounds?.maxLon;
  const boundsMaxLat = initialBounds?.maxLat;

  const spin = autoRotate ?? (viewOnly && !initialBounds);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    setTilesLoading(false);

    const disposers: Array<() => void> = [];
    const interaction: InteractionState = { stopped: false };

    const removeWheel = setupWheelPassthrough(el, enableZoom);
    if (removeWheel) disposers.push(removeWheel);

    const viewer = new Cesium.Viewer(el, {
      baseLayer: false,
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

    // ── Resolution + framerate (driven by the graphics-quality preset) ──────
    let highScale = Math.min(
      window.devicePixelRatio || 1,
      QUALITY_PRESETS[useLiveStore.getState().quality].resolutionScaleCap,
    );
    viewer.useBrowserRecommendedResolution = false;
    viewer.resolutionScale = highScale;
    viewer.targetFrameRate = QUALITY_PRESETS[useLiveStore.getState().quality].targetFrameRate;
    camera.percentageChanged = 0.05;

    let resTimer: ReturnType<typeof setTimeout> | null = null;
    const onCameraMove = () => {
      if (viewer.resolutionScale !== 1) viewer.resolutionScale = 1;
      if (resTimer) clearTimeout(resTimer);
      resTimer = setTimeout(() => { viewer.resolutionScale = highScale; }, 200);
    };
    camera.changed.addEventListener(onCameraMove);
    disposers.push(() => {
      camera.changed.removeEventListener(onCameraMove);
      if (resTimer) clearTimeout(resTimer);
    });

    // ── Pause rendering when off-screen or the tab is hidden ────────────────
    let onScreen = true;
    let pageVisible = !document.hidden;
    const applyRenderActivity = () => {
      if (viewer.isDestroyed()) return;
      const shouldRender = onScreen && pageVisible;
      if (viewer.useDefaultRenderLoop !== shouldRender) {
        viewer.useDefaultRenderLoop = shouldRender;
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0]?.isIntersecting ?? true;
        applyRenderActivity();
      },
      { threshold: 0.01 },
    );
    io.observe(el);

    const onVisibility = () => {
      pageVisible = !document.hidden;
      applyRenderActivity();
    };
    document.addEventListener('visibilitychange', onVisibility);
    disposers.push(() => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    });

    // loading states (wrapper loader + detail pill)
    disposers.push(
      createTileLoadTracker({
        scene,
        onReady: () => onReadyRef.current?.(),
        setTilesLoading,
      }),
    );

    // base imagery + day/night sync
    disposers.push(setupImagery(viewer));

    // crisp vector borders + labels; interactive (hover glow + click orbit +
    // CountryPanel/strikes) on view-only globes that aren't the game.
    const links = linksRef.current;
    const countryInteractive =
      viewOnly && !gameMode
        ? {
            scene,
            links: links ?? [],
            onPick: (slug: string) => onPickCountryRef.current?.(slug),
            homeBounds:
              boundsMinLon != null && boundsMinLat != null && boundsMaxLon != null && boundsMaxLat != null
                ? { minLon: boundsMinLon, minLat: boundsMinLat, maxLon: boundsMaxLon, maxLat: boundsMaxLat }
                : null,
          }
        : undefined;
    disposers.push(loadCountryBorders(viewer, countryInteractive));

    // dark "storm" look & feel + atmosphere
    configureScene(scene);

    // ── Graphics quality: apply the preset and react to live changes ────────
    const applyQuality = (q: GlobeQuality) => {
      if (viewer.isDestroyed()) return;
      const p = QUALITY_PRESETS[q];
      highScale = Math.min(window.devicePixelRatio || 1, p.resolutionScaleCap);
      viewer.resolutionScale = highScale;
      viewer.targetFrameRate = p.targetFrameRate;
      scene.msaaSamples = p.msaaSamples;
      scene.fog.enabled = p.fog;
      useLiveStore.getState().setAtmosphere(p.atmosphere);
    };
    applyQuality(useLiveStore.getState().quality);
    let lastQuality = useLiveStore.getState().quality;
    disposers.push(
      useLiveStore.subscribe((s) => {
        if (s.quality !== lastQuality) {
          lastQuality = s.quality;
          applyQuality(s.quality);
        }
      }),
    );

    disposers.push(attachAtmosphereGlow(scene));

    // Toggleable globe layers (fog / data-driven).
    disposers.push(attachLayers(viewer, scene));

    // camera framing
    const bounds =
      boundsMinLon != null && boundsMinLat != null && boundsMaxLon != null && boundsMaxLat != null
        ? { minLon: boundsMinLon, minLat: boundsMinLat, maxLon: boundsMaxLon, maxLat: boundsMaxLat }
        : null;
    frameCamera(camera, bounds);

    // zoom controls
    const controls = setupCameraControls({ viewer, el, enableZoom, showZoomButtons });
    zoomInRef.current = controls.zoomIn;
    zoomOutRef.current = controls.zoomOut;
    disposers.push(controls.dispose);

    // auto-rotate (+ interaction tracking shared with orbit flights)
    disposers.push(setupAutoRotate({ scene, el, camera, enabled: spin, interaction }));

    // live lightning strikes
    disposers.push(attachLightningStrikes(scene));

    // legacy multiplier betting grid (old play mode only)
    if (!viewOnly && !gameMode) {
      disposers.push(attachBettingGrid({ viewer, scene, tooltipEl: tooltipRef.current }));
    }

    // "orbit to" flights + per-country "latest 1000 strikes" layer (view-only)
    if (viewOnly) {
      disposers.push(attachOrbitFlights({ camera, interaction }));
      disposers.push(attachCountryStrikes(scene));
    }

    // round-based game zones
    if (gameMode) {
      disposers.push(
        attachGameZones({
          viewer,
          scene,
          camera,
          onPick: (z) => onPickRef.current?.(z),
        }),
      );
    }

    return () => {
      for (const dispose of disposers) dispose();
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
      <GlobeTooltip ref={tooltipRef} />
      <TileLoadingPill visible={tilesLoading} />
      {showZoomButtons && (
        <GlobeZoomButtons
          onZoomIn={() => zoomInRef.current()}
          onZoomOut={() => zoomOutRef.current()}
        />
      )}
    </div>
  );
}