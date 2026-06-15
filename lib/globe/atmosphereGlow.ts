// lib/globe/atmosphereGlow.ts
// Atmosphere halo as a full-screen post-process stage. Toggled on/off via the
// liveStore (the /live HUD button).

import * as Cesium from 'cesium';
import { useLiveStore } from '@/store/liveStore';
import { ATMOSPHERE, ATMOSPHERE_GLOW } from './config';

export function attachAtmosphereGlow(scene: Cesium.Scene): () => void {
  const { heightM, color, strength, falloff } = ATMOSPHERE_GLOW;
  const c = Cesium.Color.fromCssColorString(color);

  const fragmentShader = `
    in vec2 v_textureCoordinates;
    uniform sampler2D colorTexture;
    uniform vec3 u_color;
    uniform float u_heightM;
    uniform float u_strength;
    uniform float u_falloff;

    void main() {
      vec4 sceneColor = texture(colorTexture, v_textureCoordinates);

      vec2 ndc = v_textureCoordinates * 2.0 - 1.0;
      vec4 eye = czm_inverseProjection * vec4(ndc, 1.0, 1.0);
      eye /= eye.w;
      vec3 dir = normalize((czm_inverseView * vec4(normalize(eye.xyz), 0.0)).xyz);

      float S = 1.0e6;
      vec3 ro = czm_viewerPositionWC / S;
      float Re = 6378137.0 / S;
      float Rt = Re + u_heightM / S;

      float b  = dot(ro, dir);
      float rr = dot(ro, ro);
      float discAtm = b * b - (rr - Rt * Rt);

      float glow = 0.0;
      if (discAtm > 0.0) {
        float s   = sqrt(discAtm);
        float a0  = max(-b - s, 0.0);
        float far = max(-b + s, 0.0);

        float discE = b * b - (rr - Re * Re);
        if (discE > 0.0) {
          float e0 = -b - sqrt(discE);
          if (e0 > 0.0) far = min(far, e0);
        }

        float maxChord  = 2.0 * sqrt(max(Rt * Rt - Re * Re, 0.0));
        float thickness = max(0.0, far - a0);
        glow = pow(clamp(thickness / maxChord, 0.0, 1.0), u_falloff);
      }

      out_FragColor = vec4(sceneColor.rgb + u_color * glow * u_strength, sceneColor.a);
    }
  `;

  const stage = new Cesium.PostProcessStage({
    fragmentShader,
    uniforms: {
      u_color: new Cesium.Cartesian3(c.red, c.green, c.blue),
      u_heightM: heightM,
      u_strength: strength,
      u_falloff: falloff,
    },
  });
  scene.postProcessStages.add(stage);

  // Toggle the custom glow + the built-in sky atmosphere from the store.
  // (Built-in only turns on if ATMOSPHERE.show is also true.)
  const apply = (on: boolean) => {
    stage.enabled = on;
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = on && ATMOSPHERE.show;
  };
  apply(useLiveStore.getState().atmosphere);
  const unsub = useLiveStore.subscribe((s) => apply(s.atmosphere));

  return () => {
    unsub();
    if (!scene.isDestroyed()) scene.postProcessStages.remove(stage);
  };
}