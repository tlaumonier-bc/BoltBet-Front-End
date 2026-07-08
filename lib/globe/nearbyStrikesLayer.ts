import * as Cesium from 'cesium';
import { useLiveStore } from '@/store/liveStore';

const STRIKE_COLOR = Cesium.Color.fromCssColorString('#c084fc');
const USER_COLOR = Cesium.Color.fromCssColorString('#22d3ee');

export function attachNearbyStrikes(scene: Cesium.Scene): () => void {
  let points: Cesium.PointPrimitiveCollection | null = null;
  let currentKey = '';

  const ensure = (): Cesium.PointPrimitiveCollection => {
    if (!points) {
      points = scene.primitives.add(
        new Cesium.PointPrimitiveCollection({ blendOption: Cesium.BlendOption.TRANSLUCENT }),
      ) as Cesium.PointPrimitiveCollection;
    }
    return points;
  };

  const clear = () => {
    if (points) points.removeAll();
  };

  const render = () => {
    const { nearbyOrigin, nearbyStrikes } = useLiveStore.getState();
    const key = `${nearbyOrigin?.lat ?? ''}|${nearbyOrigin?.lon ?? ''}|${nearbyStrikes.map((s) => `${s.lat},${s.lon},${s.received_at}`).join(';')}`;
    if (key === currentKey) return;
    currentKey = key;

    clear();
    if (!nearbyOrigin || nearbyStrikes.length === 0) return;

    const col = ensure();
    col.add({
      position: Cesium.Cartesian3.fromDegrees(nearbyOrigin.lon, nearbyOrigin.lat),
      pixelSize: 11,
      color: USER_COLOR.withAlpha(0.95),
      outlineColor: Cesium.Color.WHITE.withAlpha(0.75),
      outlineWidth: 3,
      scaleByDistance: new Cesium.NearFarScalar(2.0e6, 1.4, 4.0e7, 0.8),
    });

    for (const strike of nearbyStrikes) {
      col.add({
        position: Cesium.Cartesian3.fromDegrees(strike.lon, strike.lat),
        pixelSize: 7,
        color: STRIKE_COLOR.withAlpha(0.85),
        outlineColor: STRIKE_COLOR.withAlpha(0.2),
        outlineWidth: 5,
        scaleByDistance: new Cesium.NearFarScalar(2.0e6, 1.5, 4.0e7, 0.55),
        translucencyByDistance: new Cesium.NearFarScalar(2.0e6, 1.0, 4.0e7, 0.6),
      });
    }
  };

  render();
  const unsub = useLiveStore.subscribe(render);

  return () => {
    unsub();
    if (points && !scene.isDestroyed()) scene.primitives.remove(points);
    points = null;
  };
}
