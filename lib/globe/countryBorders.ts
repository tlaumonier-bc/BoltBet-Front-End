// lib/globe/countryBorders.ts
// Crisp vector country borders + screen-space name labels from a Natural Earth
// admin-0 GeoJSON at /public/geo/countries.geojson.

import * as Cesium from 'cesium';
import {
  COUNTRY_BORDER_COLOR,
  COUNTRY_BORDER_WIDTH,
  COUNTRY_LABEL_COLOR,
  COUNTRY_LABEL_FONT,
  COUNTRY_LABEL_DISTANCE_PER_DEG,
} from './config';

// Lift borders a couple of km off the surface so the (sharp) non-clamped
// polyline renderer doesn't z-fight with the globe imagery.
const BORDER_LIFT = 1.0003; // ~2 km

function lift(positions: Cesium.Cartesian3[]): Cesium.Cartesian3[] {
  return positions.map((p) =>
    Cesium.Cartesian3.multiplyByScalar(p, BORDER_LIFT, new Cesium.Cartesian3()),
  );
}

export function loadCountryBorders(viewer: Cesium.Viewer): void {
  Cesium.GeoJsonDataSource.load('/geo/countries.geojson')
    .then((ds) => {
      if (viewer.isDestroyed()) return;
      const now = Cesium.JulianDate.now();

      const labels = new Map<string, { center: Cesium.Cartesian3; size: number; spanDeg: number }>();
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
        for (const positions of rings) {
          if (!positions || positions.length < 2) continue;
          const raised = lift(positions);
          viewer.entities.add({
            polyline: {
              positions: raised.concat([raised[0]]), // close the ring
              width: COUNTRY_BORDER_WIDTH,
              material: COUNTRY_BORDER_COLOR,
              arcType: Cesium.ArcType.GEODESIC, // hug the surface between points
              // no clampToGround → sharp MSAA polyline renderer, not the blurry
              // depth-classification path.
            },
          });
          drew++;
        }

        const props = entity.properties as
          | Record<string, { getValue: (t: Cesium.JulianDate) => unknown } | undefined>
          | undefined;
        const name =
          (props?.ADMIN?.getValue(now) as string | undefined) ??
          (props?.NAME?.getValue(now) as string | undefined) ??
          (props?.name?.getValue(now) as string | undefined);
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

      const scene = viewer.scene;
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
          disableDepthTestDistance: 0, // hidden on the far side of the globe
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        });
      }

      if (drew === 0) console.warn('[globe] countries.geojson loaded but had no polygons.');
    })
    .catch((err) => {
      console.warn('[globe] could not load /geo/countries.geojson — no borders/labels.', err);
    });
}