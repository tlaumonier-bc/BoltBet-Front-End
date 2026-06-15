// lib/globe/gameZones.ts
// Round-based game layer: the 648-zone grid as faint borders, a hover
// highlight, the player's locked-zone highlight (driven by the play store),
// and click-to-pick (zone resolved from the picked surface point).

import * as Cesium from 'cesium';
import { usePlayStore } from '@/store/playStore';
import { allZones, zoneBounds, zoneFor } from '@/lib/zones';
import { GRID_GRAY, LOCK_COLOR } from './config';

export function attachGameZones({
  viewer,
  scene,
  camera,
  onPick,
}: {
  viewer: Cesium.Viewer;
  scene: Cesium.Scene;
  camera: Cesium.Camera;
  onPick: (zoneId: string) => void;
}): () => void {
  // (a) the 648-zone grid as faint gray borders
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

  // (c) locked-zone highlight, driven by the play store
  let highlight: Cesium.Entity | null = null;
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
  const unsubLock = usePlayStore.subscribe((state) => {
    if (state.lockZoneId !== lastLock) {
      lastLock = state.lockZoneId;
      applyLock(lastLock);
    }
  });

  // (d) hover + click-to-pick
  const zoneAt = (pos: Cesium.Cartesian2): string | null => {
    const cartesian = camera.pickEllipsoid(pos, scene.globe.ellipsoid);
    if (!cartesian) return null;
    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    return zoneFor(Cesium.Math.toDegrees(carto.latitude), Cesium.Math.toDegrees(carto.longitude));
  };

  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  handler.setInputAction((m: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
    showHover(zoneAt(m.endPosition));
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  handler.setInputAction((c: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    const zid = zoneAt(c.position);
    if (zid) onPick(zid);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  return () => {
    handler.destroy();
    unsubLock();
  };
}