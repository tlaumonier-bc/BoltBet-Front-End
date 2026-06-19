// lib/globe/betZoneGrid.ts
// Game-mode overlay: the 648-zone grid as a faint gray layer with a coloured
// "Nx" multiplier on each box, hover highlight, selected highlight, and
// click-to-open-bet-modal. Built lazily the first time Game mode is entered;
// hidden (not destroyed) otherwise. Reads liveStore.mode + zoneBetStore.
import * as Cesium from 'cesium';
import { useLiveStore } from '@/store/liveStore';
import { useZoneBetStore } from '@/store/zoneBetStore';
import { allZones, zoneBounds, zoneFor } from '@/lib/zones';
import { multiplierColor } from '@/lib/game/multiplier';
import { GRID_GRAY } from './config';

const SEL_COLOR = Cesium.Color.fromCssColorString('#38bdf8');

export function attachBetZoneGrid({
  viewer,
  scene,
  camera,
}: {
  viewer: Cesium.Viewer;
  scene: Cesium.Scene;
  camera: Cesium.Camera;
}): () => void {
  let built = false;
  let visible = false;
  const rects = new Map<string, Cesium.Entity>();
  const labelByZone = new Map<string, Cesium.Label>();
  let labels: Cesium.LabelCollection | null = null;
  let hoverEnt: Cesium.Entity | null = null;
  let hoverZone: string | null = null;
  let selEnt: Cesium.Entity | null = null;
  const unsubs: Array<() => void> = [];

  const build = () => {
    if (built) return;
    built = true;
    const labelColl = scene.primitives.add(new Cesium.LabelCollection());
    labels = labelColl;
    for (const z of allZones()) {
      rects.set(
        z.id,
        viewer.entities.add({
          show: false,
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(z.lonMin, z.latMin, z.lonMax, z.latMax),
            material: Cesium.Color.TRANSPARENT,
            height: 0,
            outline: true,
            outlineColor: GRID_GRAY.withAlpha(0.25),
          },
        }),
      );
      const lat = (z.latMin + z.latMax) / 2;
      const lon = (z.lonMin + z.lonMax) / 2;
      labelByZone.set(
        z.id,
        labelColl.add({
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 30_000),
          text: '',
          font: '600 12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK.withAlpha(0.7),
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          scaleByDistance: new Cesium.NearFarScalar(3.0e6, 1.1, 3.0e7, 0.4),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3.2e7),
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          show: false,
        }),
      );
    }
  };

  const updateLabels = () => {
    const { multipliers, previewDuration } = useZoneBetStore.getState();
    for (const [zid, lbl] of labelByZone) {
      const m = multipliers[zid]?.byDuration[previewDuration];
      if (m == null) {
        lbl.text = '';
        continue;
      }
      lbl.text = `${m}x`;
      lbl.fillColor = Cesium.Color.fromCssColorString(multiplierColor(m));
    }
  };

  const ensureRectEntity = (
    ref: Cesium.Entity | null,
    fill: Cesium.Color,
    outline: Cesium.Color,
  ): Cesium.Entity => {
    if (ref) return ref;
    return viewer.entities.add({
      show: false,
      rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(0, 0, 1, 1),
        material: new Cesium.ColorMaterialProperty(fill),
        height: 0,
        outline: true,
        outlineColor: outline,
      },
    });
  };

  const moveRect = (ent: Cesium.Entity, zid: string) => {
    const b = zoneBounds(zid);
    if (ent.rectangle) {
      ent.rectangle.coordinates = new Cesium.ConstantProperty(
        Cesium.Rectangle.fromDegrees(b.lonMin, b.latMin, b.lonMax, b.latMax),
      );
    }
    ent.show = true;
  };

  const showHover = (zid: string | null) => {
    if (zid === hoverZone) return;
    hoverZone = zid;
    scene.canvas.style.cursor = zid ? 'pointer' : 'default';
    hoverEnt = ensureRectEntity(hoverEnt, GRID_GRAY.withAlpha(0.14), GRID_GRAY.withAlpha(0.6));
    if (!zid) {
      hoverEnt.show = false;
      return;
    }
    moveRect(hoverEnt, zid);
  };

  const applySelected = (zid: string | null) => {
    selEnt = ensureRectEntity(selEnt, SEL_COLOR.withAlpha(0.22), SEL_COLOR.withAlpha(0.95));
    if (!zid || !visible) {
      selEnt.show = false;
      return;
    }
    moveRect(selEnt, zid);
  };

  const setVisible = (on: boolean) => {
    if (on && !built) build();
    visible = on;
    for (const r of rects.values()) r.show = on;
    for (const l of labelByZone.values()) l.show = on;
    if (on) {
      updateLabels();
      applySelected(useZoneBetStore.getState().selectedZoneId);
    } else {
      if (hoverEnt) hoverEnt.show = false;
      if (selEnt) selEnt.show = false;
      hoverZone = null;
      scene.canvas.style.cursor = 'default';
    }
  };

  const zoneAt = (pos: Cesium.Cartesian2): string | null => {
    const cart = camera.pickEllipsoid(pos, scene.globe.ellipsoid);
    if (!cart) return null;
    const carto = Cesium.Cartographic.fromCartesian(cart);
    return zoneFor(Cesium.Math.toDegrees(carto.latitude), Cesium.Math.toDegrees(carto.longitude));
  };

  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  handler.setInputAction((m: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
    if (useLiveStore.getState().mode !== 'game') return;
    showHover(zoneAt(m.endPosition));
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  handler.setInputAction((c: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    if (useLiveStore.getState().mode !== 'game') return;
    const zid = zoneAt(c.position);
    if (zid) useZoneBetStore.getState().selectZone(zid);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // react to mode
  let lastMode = useLiveStore.getState().mode;
  setVisible(lastMode === 'game');
  unsubs.push(
    useLiveStore.subscribe((s) => {
      if (s.mode !== lastMode) {
        lastMode = s.mode;
        setVisible(lastMode === 'game');
      }
    }),
  );

  // react to multipliers / preview duration / selection
  let lastMult = useZoneBetStore.getState().multipliers;
  let lastDur = useZoneBetStore.getState().previewDuration;
  let lastSel = useZoneBetStore.getState().selectedZoneId;
  unsubs.push(
    useZoneBetStore.subscribe((s) => {
      if (visible && (s.multipliers !== lastMult || s.previewDuration !== lastDur)) {
        lastMult = s.multipliers;
        lastDur = s.previewDuration;
        updateLabels();
      }
      if (s.selectedZoneId !== lastSel) {
        lastSel = s.selectedZoneId;
        applySelected(lastSel);
      }
    }),
  );

  return () => {
    for (const u of unsubs) u();
    if (!handler.isDestroyed()) handler.destroy();
    if (!scene.isDestroyed()) {
      for (const r of rects.values()) viewer.entities.remove(r);
      if (hoverEnt) viewer.entities.remove(hoverEnt);
      if (selEnt) viewer.entities.remove(selEnt);
      if (labels) scene.primitives.remove(labels);
    }
  };
}