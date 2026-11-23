// ============================================================================
//  ערפל מלחמה: ערפל מיסטי מתערבל, צללי עננים נעים ונדנוד רוח בעצים
// ============================================================================
import * as THREE from 'three';

export const fogUniforms = {
  uFogTex: { value: null },
  uFogSize: { value: new THREE.Vector2(1, 1) },
  uFogOn: { value: 0 },
  uWindTime: { value: 0 },
};

const patched = new WeakSet();

/** Patch a material so it receives animated fog-of-war, cloud shadows, and optional wind sway. */
export function patchFog(material, { sway = false } = {}) {
  if (!material || patched.has(material)) return material;
  if (
    material.isShaderMaterial ||
    material.isSpriteMaterial ||
    material.isPointsMaterial ||
    material.isLineBasicMaterial
  ) {
    return material;
  }
  patched.add(material);
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(material, shader, renderer);
    shader.uniforms.uFogTex = fogUniforms.uFogTex;
    shader.uniforms.uFogSize = fogUniforms.uFogSize;
    shader.uniforms.uFogOn = fogUniforms.uFogOn;
    shader.uniforms.uWindTime = fogUniforms.uWindTime;
    let vs = shader.vertexShader;
    vs = vs.replace(
      '#include <common>',
      `#include <common>
varying vec3 vFogW;
uniform float uWindTime;
${sway ? 'attribute float sway;' : ''}`,
    );
    if (sway) {
      vs = vs.replace(
        '#include <project_vertex>',
        `
#ifdef USE_INSTANCING
  vec4 swBase = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
#else
  vec4 swBase = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
#endif
  float swPh = swBase.x * 0.71 + swBase.z * 0.93;
  transformed.x += sin(uWindTime * 1.7 + swPh) * 0.048 * sway;
  transformed.z += cos(uWindTime * 1.3 + swPh * 1.3) * 0.032 * sway;
#include <project_vertex>`,
      );
    }
    vs = vs.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
#ifdef USE_INSTANCING
  vFogW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vFogW = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`,
    );
    shader.vertexShader = vs;

    let fs = shader.fragmentShader;
    fs = fs.replace(
      '#include <common>',
      `#include <common>
varying vec3 vFogW;
uniform sampler2D uFogTex;
uniform vec2 uFogSize;
uniform float uFogOn;
uniform float uWindTime;`,
    );
    fs = fs.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
if (uFogOn > 0.5) {
  // Subtle drifting cloud shadows across the world
  vec2 cUv = vFogW.xz * 0.14 + vec2(uWindTime * 0.018, uWindTime * 0.011);
  float cWave = sin(cUv.x * 2.3 + sin(cUv.y * 1.9)) * cos(cUv.y * 2.1 - cos(cUv.x * 1.7));
  float cloudMul = mix(0.89, 1.04, smoothstep(-0.6, 0.6, cWave));
  gl_FragColor.rgb *= cloudMul;

  // Animated swirling fog-of-war boundary
  vec2 fUv = vFogW.xz / uFogSize;
  vec2 swirl = vec2(
    sin(vFogW.z * 1.35 + uWindTime * 0.45) + cos(vFogW.x * 0.85 - uWindTime * 0.3),
    cos(vFogW.x * 1.35 - uWindTime * 0.4) + sin(vFogW.z * 0.9 + uWindTime * 0.35)
  ) * (0.32 / max(uFogSize.x, 1.0));
  float rawFog = texture2D(uFogTex, clamp(fUv + swirl, 0.002, 0.998)).r;
  float fogF = smoothstep(0.08, 0.92, rawFog);

  // Rolling mystical mist in unexplored territory + warm golden-twilight border rim
  float mistPattern = 0.5 + 0.5 * sin(vFogW.x * 1.2 + uWindTime * 0.25 + sin(vFogW.z * 1.1 - uWindTime * 0.2));
  vec3 deepMist = mix(vec3(0.016, 0.020, 0.038), vec3(0.038, 0.046, 0.078), mistPattern);
  float edgeBand = smoothstep(0.05, 0.45, fogF) * (1.0 - smoothstep(0.45, 0.88, fogF));
  vec3 rimTint = vec3(0.22, 0.17, 0.10) * edgeBand;
  gl_FragColor.rgb = mix(deepMist, gl_FragColor.rgb + rimTint, fogF);
}`,
    );
    shader.fragmentShader = fs;
  };
  material.customProgramCacheKey = () =>
    (prevKey ? prevKey() : '') + (sway ? '|fogsway2' : '|fog2');
  material.needsUpdate = true;
  return material;
}

export function patchObjectFog(obj) {
  obj.traverse((o) => {
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => patchFog(m));
      else patchFog(o.material);
    }
  });
}
