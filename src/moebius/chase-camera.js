import * as THREE from 'three';
import { pointOnMoebius, normalOnMoebius, ribbonFrame } from './geometry.js';

const STANDOFF_FACTOR = 1.6;
const LOOKAHEAD = 0.006;
const EASE_FACTOR = 0.08;

// Cámara que sigue el glow activo de una voz
export function createChaseCamera({ transport, targets, radius, width, aspect, getTwistParams = () => ({ twistTurns: 0.5 }) }) {
  const camera = new THREE.PerspectiveCamera(50, aspect, 0.01, 100);
  const standoff = width * STANDOFF_FACTOR;

  function resolveRadius() {
    return typeof radius === 'function' ? radius() : radius;
  }

  let currentU = 0;
  let currentV = 0.5;
  let lockedTarget = null;

  function resolveTargets() {
    return typeof targets === 'function' ? targets() : targets;
  }

  function pickTarget(list) {
    if (lockedTarget && list.includes(lockedTarget) && lockedTarget.uniforms.uGlowIntensity.value > 0) return lockedTarget;
    return list.find((t) => t.uniforms.uActiveUV.value.x >= 0 && t.uniforms.uGlowIntensity.value > 0) || list[0];
  }

  function update() {
    const list = resolveTargets();
    lockedTarget = pickTarget(list);
    const { uniforms, side } = lockedTarget;
    const twistParams = getTwistParams();
    const currentRadius = resolveRadius();

    if (uniforms.uActiveUV.value.x >= 0) {
      const targetU = uniforms.uActiveUV.value.x;
      const targetV = uniforms.uActiveUV.value.y;
      const deltaU = targetU - currentU;
      if (Math.abs(deltaU) > 0.5) {
        // Evita interpolar por el camino largo en el salto de cara o loop
        currentU = targetU;
        currentV = targetV;
      } else {
        currentU += deltaU * EASE_FACTOR;
        currentV += (targetV - currentV) * EASE_FACTOR;
      }
    }

    const s = -1 + 2 * currentV;
    const point = pointOnMoebius(currentU, s, { radius: currentRadius, width, ...twistParams });
    const normal = normalOnMoebius(currentU, { radius: currentRadius, ...twistParams });
    const { offsetDir } = ribbonFrame(currentU, { radius: currentRadius, ...twistParams });
    const uAhead = Math.min(currentU + LOOKAHEAD, 1);
    const aheadPoint = pointOnMoebius(uAhead, s, { radius: currentRadius, width, ...twistParams });

    camera.position.copy(point).addScaledVector(normal, -side * standoff);
    camera.up.copy(offsetDir);
    camera.lookAt(aheadPoint);
  }

  transport.on('tick', update);
  update();

  return {
    camera, update, getSide: () => lockedTarget.side,
    getU: () => currentU, getV: () => currentV,
  };
}
