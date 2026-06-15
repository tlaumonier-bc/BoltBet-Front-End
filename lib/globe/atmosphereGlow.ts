// lib/globe/atmosphereGlow.ts
// Atmosphere as a discrete back-side ellipsoid shell with a Fresnel rim — a
// distinct sphere around the globe, not a scattering gradient. Implemented as a
// Material (not a raw Appearance shader) so Cesium handles WebGL1/2 GLSL
// versioning; a hand-written appearance shader hits "'varying': reserved word"
// on WebGL2. Toggled via the /live HUD store.

import * as Cesium from 'cesium';
import { useLiveStore } from '@/store/liveStore';
import { ATMOSPHERE_GLOW } from './config';

export function attachAtmosphereGlow(scene: Cesium.Scene): () => void {
  const { scale, color, strength, falloff } = ATMOSPHERE_GLOW;
  const c = Cesium.Color.fromCssColorString(color);

  const shellRadii = Cesium.Cartesian3.multiplyByScalar(
    Cesium.Ellipsoid.WGS84.radii,
    scale,
    new Cesium.Cartesian3(),
  );

  // BASIC support => geometry carries position + normal, and the material gets
  // materialInput.normalEC / positionToEyeEC, which the Fresnel needs.
  const support = Cesium.MaterialAppearance.MaterialSupport.BASIC;

  const geometry = new Cesium.EllipsoidGeometry({
    radii: shellRadii,
    vertexFormat: support.vertexFormat,
  });

  const material = new Cesium.Material({
    fabric: {
      type: 'AtmosphereRim',
      uniforms: { glowColor: c, strength, falloff },
      // Use emission (not diffuse) so the rim doesn't depend on scene lighting.
      // abs(dot) makes it invariant to which face/normal direction is rendered.
      source: `
        czm_material czm_getMaterial(czm_materialInput materialInput) {
          czm_material material = czm_getDefaultMaterial(materialInput);
          vec3 N = normalize(materialInput.normalEC);
          vec3 V = normalize(materialInput.positionToEyeEC);
          float rim = pow(1.0 - abs(dot(N, V)), falloff);
          material.diffuse = vec3(0.0);
          material.emission = glowColor.rgb;
          material.alpha = rim * strength * glowColor.a;
          return material;
        }
      `,
    },
  });

  const appearance = new Cesium.MaterialAppearance({
    material,
    materialSupport: support,
    translucent: true,
    closed: false,
    renderState: {
      // Cull FRONT faces => draw the far side of the shell, so the glow sits on
      // the limb around the planet (THREE.BackSide equivalent).
      cull: { enabled: true, face: Cesium.CullFace.FRONT },
      depthTest: { enabled: true }, // occluded where it overlaps the globe disc
      depthMask: false,
      blending: Cesium.BlendingState.ALPHA_BLEND,
    },
  });

  const primitive = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({ geometry }),
    appearance,
    asynchronous: false,
    allowPicking: false, // never intercept zone/cell picks
  });
  scene.primitives.add(primitive);

  const apply = (on: boolean) => { primitive.show = on; };
  apply(useLiveStore.getState().atmosphere);
  const unsub = useLiveStore.subscribe((s) => apply(s.atmosphere));

  return () => {
    unsub();
    if (!scene.isDestroyed()) scene.primitives.remove(primitive); // remove() also destroys it
  };
}