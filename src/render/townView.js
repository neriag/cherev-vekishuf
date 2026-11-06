// ============================================================================
//  תצוגת העיר התלת-ממדית (עטיפה סביב townScene + תאורה דרמטית ואינטראקציה)
// ============================================================================
import * as THREE from 'three';
import { buildTownLayout, playConstructionEffect } from './townScene.js';
import { BUILD_CHAINS, getBuildings } from '../data/buildings.js';
import { hasBuilt } from '../core/state.js';

export class TownView {
  constructor(town, overlay, callbacks) {
    this.town = town;
    this.overlay = overlay;
    this.cb = callbacks || {};
    this.scene = new THREE.Scene();
    this.layout = buildTownLayout(town.faction);
    this.buildingsMeta = getBuildings(town.faction);

    const camCfg = this.layout.camera || { position: [0, 11, 22], target: [0, 1.5, 0], fov: 40 };
    this.camera = new THREE.PerspectiveCamera(
      camCfg.fov || 40,
      window.innerWidth / window.innerHeight,
      0.5,
      350,
    );
    this.basePos = new THREE.Vector3(...camCfg.position);
    this.baseTarget = new THREE.Vector3(...camCfg.target);
    this.mouseOffset = new THREE.Vector2(0, 0);
    this.hoveredId = null;

    const isNecro = town.faction === 'necropolis';
    const L = this.layout.lighting || {};
    this.scene.background = new THREE.Color(L.fogColor || (isNecro ? '#120d1e' : '#6ca6dc'));
    this.scene.fog = new THREE.Fog(
      L.fogColor || (isNecro ? '#120d1e' : '#6ca6dc'),
      L.fogNear || 30,
      L.fogFar || 110,
    );

    const hemi = new THREE.HemisphereLight(
      L.ambientSky || (isNecro ? '#6e5ca8' : '#e2f0ff'),
      L.ambientGround || (isNecro ? '#24182e' : '#52422c'),
      L.ambientIntensity ?? 1.18,
    );
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(
      L.sunColor || (isNecro ? '#b8c8ff' : '#fff2d4'),
      L.sunIntensity ?? 2.45,
    );
    sun.position.set(...(L.sunPosition || [-18, 28, 18]));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 90;
    sc.updateProjectionMatrix();
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.018;
    this.scene.add(sun);

    // Opposite-side atmospheric rim light for sculptural depth
    const rim = new THREE.DirectionalLight(isNecro ? '#4eff98' : '#7cb4ff', isNecro ? 0.45 : 0.48);
    rim.position.set(18, 14, -16);
    this.scene.add(rim);

    // Warm plaza & citadel accent point lights
    const plazaLight = new THREE.PointLight(isNecro ? '#48ff88' : '#ffaa44', 1.05, 16);
    plazaLight.position.set(0, 2.8, 3.5);
    this.scene.add(plazaLight);
    this.plazaLight = plazaLight;

    const keepLight = new THREE.PointLight(isNecro ? '#9c52ff' : '#ffd278', 0.95, 18);
    keepLight.position.set(0, 5.5, -5.5);
    this.scene.add(keepLight);

    this.hoverLight = new THREE.PointLight('#ffe082', 0, 9);
    this.scene.add(this.hoverLight);

    this.scene.add(this.layout.root);

    // Floating hover tag
    this.hoverTag = document.createElement('div');
    this.hoverTag.className = 'town-building-tag';
    this.hoverTag.style.display = 'none';
    this.overlay.appendChild(this.hoverTag);

    this.syncBuiltVisibility();
    this.setupPointer();
  }

  /** Show only the highest built building in each chain. */
  syncBuiltVisibility() {
    const B = this.layout.buildings || {};
    for (const obj of Object.values(B)) if (obj) obj.visible = false;
    for (const chain of BUILD_CHAINS) {
      let highest = null;
      for (const id of chain) {
        if (hasBuilt(this.town, id)) highest = id;
      }
      if (highest && B[highest]) B[highest].visible = true;
    }
  }

  async animateConstructed(buildingId) {
    this.syncBuiltVisibility();
    try {
      await playConstructionEffect?.(this.layout, buildingId);
    } catch {}
  }

  setupPointer() {
    const ray = new THREE.Raycaster();

    const pickBuilding = (e) => {
      const ndc = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );
      ray.setFromCamera(ndc, this.camera);
      const visibleRoots = Object.entries(this.layout.buildings || {})
        .filter(([, o]) => o && o.visible)
        .map(([, o]) => o);
      const hits = ray.intersectObjects(visibleRoots, true);
      for (const h of hits) {
        let cur = h.object;
        while (cur) {
          if (cur.userData?.buildingId) return cur.userData.buildingId;
          cur = cur.parent;
        }
      }
      return null;
    };

    this.onPointerMove = (e) => {
      this.mouseOffset.set(
        (e.clientX / window.innerWidth - 0.5) * 1.15,
        -(e.clientY / window.innerHeight - 0.5) * 0.55,
      );
      if (e.target.closest('.town-ui, .modal-backdrop')) {
        this.setHover(null);
        return;
      }
      const id = pickBuilding(e);
      this.setHover(id, e.clientX, e.clientY);
    };

    this.onPointerDown = (e) => {
      if (e.button !== 0 || e.target.closest('.town-ui, .modal-backdrop')) return;
      const id = pickBuilding(e);
      if (id) this.cb.onBuildingClick?.(id);
    };

    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerdown', this.onPointerDown);
  }

  setHover(id, x = 0, y = 0) {
    if (this.hoveredId !== id) {
      if (this.hoveredId) this.tintBuilding(this.hoveredId, false);
      this.hoveredId = id;
      if (id) this.tintBuilding(id, true);
    }
    if (id && this.buildingsMeta[id]) {
      this.hoverTag.style.display = 'block';
      this.hoverTag.style.left = `${x}px`;
      this.hoverTag.style.top = `${y - 18}px`;
      this.hoverTag.textContent = this.buildingsMeta[id].name;
      document.body.style.cursor = 'pointer';
      const root = this.layout.buildings?.[id];
      if (root && this.hoverLight) {
        const box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        this.hoverLight.position.copy(center).add(new THREE.Vector3(0, 2.2, 1.5));
        this.hoverLight.intensity = 2.2;
      }
    } else {
      this.hoverTag.style.display = 'none';
      document.body.style.cursor = '';
      if (this.hoverLight) this.hoverLight.intensity = 0;
    }
  }

  tintBuilding(id, on) {
    const root = this.layout.buildings?.[id];
    if (!root) return;
    root.traverse((m) => {
      if (!m.isMesh || !m.material) return;
      if (!m.userData._origMat) m.userData._origMat = m.material;
      if (on) {
        const clone = m.userData._origMat.clone();
        if (clone.emissive) {
          clone.emissive = new THREE.Color('#ffcf66');
          clone.emissiveIntensity = (clone.emissiveIntensity || 0) + 0.28;
        }
        m.material = clone;
      } else if (m.userData._origMat) {
        m.material = m.userData._origMat;
      }
    });
  }

  update(dt, time) {
    const breatheX = Math.sin(time * 0.38) * 0.28;
    const breatheY = Math.cos(time * 0.29) * 0.12;
    this.camera.position.set(
      this.basePos.x + this.mouseOffset.x + breatheX,
      this.basePos.y + this.mouseOffset.y + breatheY,
      this.basePos.z,
    );
    this.camera.lookAt(this.baseTarget);
    if (this.plazaLight) {
      this.plazaLight.intensity = 1.05 + Math.sin(time * 6.5) * 0.16;
    }
    this.layout.update?.(dt, time);
  }

  dispose() {
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerdown', this.onPointerDown);
    if (this.hoveredId) this.tintBuilding(this.hoveredId, false);
    this.hoverTag.remove();
    document.body.style.cursor = '';
  }
}
