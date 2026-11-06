// ============================================================================
//  מנוע הרינדור המשותף: WebGLRenderer, תאורת סביבה (IBL), וצינור Post-Processing
// ============================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const FantasyGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1920, 1080) },
    uSharpness: { value: 0.28 },
    uVignette: { value: 0.28 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uSharpness;
    uniform float uVignette;
    varying vec2 vUv;

    void main() {
      vec2 texel = 1.0 / max(uResolution, vec2(1.0));
      vec4 center = texture2D(tDiffuse, vUv);
      vec3 c = center.rgb;

      // Subtle 4-tap unsharp mask for crisp fantasy detail
      vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb;
      vec3 s = texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).rgb;
      vec3 e = texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb;
      vec3 w = texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).rgb;
      vec3 blur = 0.25 * (n + s + e + w);
      c = clamp(c + (c - blur) * uSharpness, 0.0, 1.0);

      // Rich HoMM3-inspired fantasy color grade: warm golden sunlight, deep indigo-bronze shadows, vibrant midtones
      float luma = dot(c, vec3(0.299, 0.587, 0.114));
      vec3 sat = mix(vec3(luma), c, 1.22);
      vec3 shadowTint = vec3(0.92, 0.94, 1.05);
      vec3 highlightTint = vec3(1.03, 1.00, 0.95);
      c = sat * mix(shadowTint, highlightTint, smoothstep(0.12, 0.86, luma));

      // Gentle S-curve contrast for rich sculptural depth
      c = mix(c, smoothstep(0.025, 0.975, c), 0.26);

      // Soft cinematic vignette
      vec2 d = (vUv - 0.5) * vec2(1.12, 0.95);
      float vig = clamp(1.0 - dot(d, d) * uVignette, 0.70, 1.0);
      c *= vig;

      gl_FragColor = vec4(clamp(c, 0.0, 1.0), center.a);
    }
  `,
};

class Engine {
  constructor() {
    this.renderer = null;
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.gradePass = null;
    this.envMap = null;
    this.view = null;
    this.last = performance.now();
    this.time = 0;
    this.paused = false;
    this.listeners = new Set();
  }

  init(container) {
    const r = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    const gl = r.getContext();
    const dbg = gl?.getExtension?.('WEBGL_debug_renderer_info');
    const gpuRenderer = (dbg && gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) || '';
    const isSoftware = /swiftshader|llvmpipe|software/i.test(gpuRenderer);

    const pr = isSoftware ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    r.setPixelRatio(pr);
    r.setSize(window.innerWidth, window.innerHeight);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.88;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);
    r.domElement.id = 'gl';
    this.renderer = r;

    // Generate shared IBL environment texture so metals, gold, armor, crystals, and water reflect richly
    try {
      const pmrem = new THREE.PMREMGenerator(r);
      pmrem.compileEquirectangularShader();
      const roomEnv = new RoomEnvironment();
      this.envMap = pmrem.fromScene(roomEnv, 0.04).texture;
      roomEnv.dispose?.();
      pmrem.dispose();
    } catch (e) {
      console.warn('PMREM init fallback:', e);
    }

    // Setup Post-Processing Composer (RenderPass -> UnrealBloomPass -> OutputPass -> FantasyGradeShader)
    try {
      const w = window.innerWidth, h = window.innerHeight;
      const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, {
        type: THREE.HalfFloatType,
        samples: isSoftware ? 0 : 2,
      });
      this.composer = new EffectComposer(r, rt);
      this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.45, 0.88);
      this.outputPass = new OutputPass();
      this.gradePass = new ShaderPass(FantasyGradeShader);
      this.gradePass.uniforms.uResolution.value.set(w * pr, h * pr);
      this.gradePass.uniforms.uSharpness.value = 0.36;

      this.composer.addPass(this.renderPass);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(this.outputPass);
      this.composer.addPass(this.gradePass);
    } catch (e) {
      console.warn('Post-processing init fallback:', e);
      this.composer = null;
    }

    window.addEventListener('resize', () => this.resize());
    const loop = () => {
      requestAnimationFrame(loop);
      if (this.paused) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      for (const fn of this.listeners) fn(dt, this.time);
      if (this.view) {
        if (this.view.scene && this.envMap && !this.view.scene.environment) {
          this.view.scene.environment = this.envMap;
          this.view.scene.environmentIntensity = 0.18;
        }
        this.view.update?.(dt, this.time);
        this.renderCurrentView();
      }
    };
    loop();
  }

  renderCurrentView() {
    if (!this.view || !this.view.scene || !this.view.camera) return;
    this.view.onBeforeRender?.();
    if (this.composer && this.renderPass) {
      this.renderPass.scene = this.view.scene;
      this.renderPass.camera = this.view.camera;
      this.composer.render();
    } else if (this.view.render) {
      this.view.render(this.renderer);
    } else {
      this.renderer.render(this.view.scene, this.view.camera);
    }
    this.view.onAfterRender?.();
  }

  setView(view) {
    if (this.view && this.view !== view) this.view.onDeactivate?.();
    this.view = view;
    if (view?.scene && this.envMap && !view.scene.environment) {
      view.scene.environment = this.envMap;
      view.scene.environmentIntensity = 0.18;
    }
    view?.onActivate?.();
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
      this.bloomPass?.resolution?.set(w, h);
      this.gradePass?.uniforms?.uResolution?.value?.set(w * pr, h * pr);
    }
    if (this.view?.camera) {
      this.view.camera.aspect = w / h;
      this.view.camera.updateProjectionMatrix();
    }
    this.view?.onResize?.(w, h);
  }

  onFrame(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const engine = new Engine();

/** Promise that resolves after `ms` milliseconds (scaled by animation speed). */
export function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** Tween helper running on the engine loop. fn(t) with eased t in [0,1]. */
export function tween(duration, fn, ease = (t) => t) {
  return new Promise((resolve) => {
    let el = 0;
    if (duration <= 0) { fn(1); resolve(); return; }
    const off = engine.onFrame((dt) => {
      el += dt;
      const t = Math.min(1, el / duration);
      fn(ease(t));
      if (t >= 1) { off(); resolve(); }
    });
  });
}
export const ease = {
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
