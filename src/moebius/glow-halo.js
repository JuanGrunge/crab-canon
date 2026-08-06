import * as THREE from 'three';
import { pointOnMoebius, normalOnMoebius } from './geometry.js';

function buildRadialTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function createGlowHalo({ radius, width, color, twistTurns = 0.5, fixedTwist = null }) {
  const texture = buildRadialTexture();
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  });
  const sprite = new THREE.Sprite(material);
  const scale = width * 0.32;
  sprite.scale.set(scale, scale, 1);
  const HALO_OFFSET = width * 0.12;

  function setState({ u, v, color: nextColor, intensity, side }) {
    const s = -1 + 2 * v;
    const point = pointOnMoebius(u, s, { radius, width, twistTurns, fixedTwist });
    const normal = normalOnMoebius(u, { radius, twistTurns, fixedTwist });
    sprite.position.copy(point).addScaledVector(normal, -side * HALO_OFFSET);
    sprite.material.color.set(nextColor);
    sprite.material.opacity = intensity * 0.35;
  }

  return { sprite, setState };
}
