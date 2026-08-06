import * as THREE from 'three';

function circlePoint(t, radius) {
  return new THREE.Vector3(radius * Math.cos(t), 0, radius * Math.sin(t));
}

function circleTangent(t, radius, dt = 1e-4) {
  const before = circlePoint(t - dt, radius);
  const after = circlePoint(t + dt, radius);
  return after.sub(before).normalize();
}

// Marco geométrico local de la cinta
export function ribbonFrame(u, { radius, twistTurns = 0.5, fixedTwist = null }) {
  const worldUp = new THREE.Vector3(0, 1, 0);
  const t = -(Math.PI * 2 * u); // sentido de recorrido de la cinta
  const center = circlePoint(t, radius);
  const tangent = circleTangent(t, radius);

  const side = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
  const up2 = new THREE.Vector3().crossVectors(side, tangent).normalize();

  const twist = fixedTwist !== null ? fixedTwist : t * twistTurns;
  const offsetDir = side.clone()
    .multiplyScalar(Math.cos(twist))
    .add(up2.clone().multiplyScalar(Math.sin(twist)));

  return { center, tangent, offsetDir };
}

// Punto físico de la cinta
export function pointOnMoebius(u, s, { radius, width, twistTurns = 0.5, fixedTwist = null }) {
  const { center, offsetDir } = ribbonFrame(u, { radius, twistTurns, fixedTwist });
  return center.clone().addScaledVector(offsetDir, (s * width) / 2);
}

// Normal de la superficie de la cinta
export function normalOnMoebius(u, { radius, twistTurns = 0.5, fixedTwist = null }) {
  const { tangent, offsetDir } = ribbonFrame(u, { radius, twistTurns, fixedTwist });
  return new THREE.Vector3().crossVectors(tangent, offsetDir).normalize();
}

// Geometría de la banda de Moebius: superficie única, sin costura
export function buildMoebiusGeometry({ radius, width, segments, crossSegments, twistTurns = 0.5, fixedTwist = null }) {
  const positions = [];
  const uvs = [];
  const vertsPerRing = crossSegments + 1;

  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments;
    for (let j = 0; j <= crossSegments; j += 1) {
      const s = -1 + (2 * j) / crossSegments;
      const point = pointOnMoebius(u, s, { radius, width, twistTurns, fixedTwist });
      positions.push(point.x, point.y, point.z);
      uvs.push(u, j / crossSegments);
    }
  }

  const indices = [];
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < crossSegments; j += 1) {
      const a = i * vertsPerRing + j;
      const b = a + 1;
      const c = a + vertsPerRing;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return { geometry };
}

// Geometría del cilindro: variante sin torsión de la cinta
export function buildCylinderGeometry({ radius, width, segments, crossSegments }) {
  return buildMoebiusGeometry({ radius, width, segments, crossSegments, fixedTwist: Math.PI / 2 });
}
