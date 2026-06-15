// lib/globe/camera.ts
// Camera framing, zoom controls, wheel passthrough, auto-rotate, orbit flights.

import * as Cesium from 'cesium';
import { useLiveStore } from '@/store/liveStore';
import {
  FLY_HEIGHT_M,
  MAX_ZOOM_DISTANCE_M,
  MIN_ZOOM_DISTANCE_M,
  SEO_ZOOM_PADDING,
} from './config';

export interface InteractionState {
  /** True once the user interacts (or an orbit flight starts). Stops the spin. */
  stopped: boolean;
}

export interface GlobeBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/** Frame the (padded) country box, or fall back to a whole-globe view. */
export function frameCamera(camera: Cesium.Camera, bounds: GlobeBounds | null): void {
  if (bounds) {
    const lonPad = ((bounds.maxLon - bounds.minLon) * (SEO_ZOOM_PADDING - 1)) / 2;
    const latPad = ((bounds.maxLat - bounds.minLat) * (SEO_ZOOM_PADDING - 1)) / 2;
    camera.setView({
      destination: Cesium.Rectangle.fromDegrees(
        bounds.minLon - lonPad,
        bounds.minLat - latPad,
        bounds.maxLon + lonPad,
        bounds.maxLat + latPad,
      ),
    });
  } else {
    camera.setView({ destination: Cesium.Cartesian3.fromDegrees(0, 20, 20_000_000) });
  }
  camera.constrainedAxis = Cesium.Cartesian3.UNIT_Z; // keeps the globe level + clean spin
}

/**
 * When zoom is disabled, let wheel events scroll the page instead of being
 * swallowed by Cesium. Stop propagation in the capture phase but never
 * preventDefault, so the browser still scrolls. Returns a disposer (or null).
 */
export function setupWheelPassthrough(el: HTMLElement, enableZoom: boolean): (() => void) | null {
  if (enableZoom) return null;
  const onWheelCapture = (e: Event) => e.stopPropagation();
  el.addEventListener('wheel', onWheelCapture, { capture: true, passive: true });
  return () => el.removeEventListener('wheel', onWheelCapture, { capture: true });
}

export interface CameraControls {
  zoomIn: () => void;
  zoomOut: () => void;
  dispose: () => void;
}

export function setupCameraControls({
  viewer,
  el,
  enableZoom,
  showZoomButtons,
}: {
  viewer: Cesium.Viewer;
  el: HTMLElement;
  enableZoom: boolean;
  showZoomButtons: boolean;
}): CameraControls {
  const { scene, camera } = viewer;
  const ctrl = scene.screenSpaceCameraController;
  ctrl.enableZoom = enableZoom;
  ctrl.minimumZoomDistance = MIN_ZOOM_DISTANCE_M;
  ctrl.maximumZoomDistance = MAX_ZOOM_DISTANCE_M;

  // Tame wheel/trackpad zoom: kill the coasting inertia and reduce the per-step
  // factor (default 5 rockets to the limit on a trackpad flick).
  ctrl.inertiaZoom = 0.0;
  (ctrl as unknown as { _zoomFactor: number })._zoomFactor = 1.5;

  const zoomStep = () => Math.max(camera.positionCartographic.height * 0.3, MIN_ZOOM_DISTANCE_M);
  const zoomIn = () => camera.zoomIn(zoomStep());
  const zoomOut = () => camera.zoomOut(zoomStep());

  let onDblClick: (() => void) | null = null;
  if (showZoomButtons) {
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    );
    onDblClick = () => zoomIn();
    el.addEventListener('dblclick', onDblClick);
  }

  return {
    zoomIn,
    zoomOut,
    dispose: () => {
      if (onDblClick) el.removeEventListener('dblclick', onDblClick);
    },
  };
}

/**
 * Auto-spin until the user interacts. Interaction tracking is always set up (so
 * orbit flights / clicks stop the spin); the rotation runs only when `enabled`.
 */
export function setupAutoRotate({
  scene,
  el,
  camera,
  enabled,
  interaction,
}: {
  scene: Cesium.Scene;
  el: HTMLElement;
  camera: Cesium.Camera;
  enabled: boolean;
  interaction: InteractionState;
}): () => void {
  const stopSpin = () => {
    interaction.stopped = true;
  };
  const events = ['mousedown', 'touchstart', 'wheel', 'pointerdown'];
  events.forEach((ev) => el.addEventListener(ev, stopSpin, { passive: true }));

  const onSpin = () => {
    if (enabled && !interaction.stopped) camera.rotateRight(0.0006);
  };
  if (enabled) scene.preRender.addEventListener(onSpin);

  return () => {
    events.forEach((ev) => el.removeEventListener(ev, stopSpin));
    if (enabled && !scene.isDestroyed()) scene.preRender.removeEventListener(onSpin);
  };
}

/** "Orbit to" camera flights driven by the /live HUD store. */
export function attachOrbitFlights({
  camera,
  interaction,
}: {
  camera: Cesium.Camera;
  interaction: InteractionState;
}): () => void {
  let lastReq = 0;
  const unsub = useLiveStore.subscribe((state) => {
    const t = state.orbitTarget;
    if (t && t.requestedAt !== lastReq) {
      lastReq = t.requestedAt;
      interaction.stopped = true; // stop the spin so it doesn't fight the flight
      camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(t.lon, t.lat, FLY_HEIGHT_M),
        duration: 1.6,
      });
    }
  });
  return () => unsub();
}