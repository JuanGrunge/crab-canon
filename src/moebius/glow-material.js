import * as THREE from 'three';

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
uniform sampler2D map;
uniform vec2 uActiveUV;
uniform float uGlowIntensity;
uniform vec3 uGlowColor;
uniform float uAspect;
uniform float uGlowRadiusU;
uniform float uGlowRadiusV;
uniform float uSolidRadiusU;
uniform float uSolidRadiusV;
varying vec2 vUv;

void main() {
  vec4 base = texture2D(map, vUv);

  float du = abs(vUv.x - uActiveUV.x);
  du = min(du, 1.0 - du);
  float dv = vUv.y - uActiveUV.y;

  float distGlow = length(vec2((du * uAspect) / uGlowRadiusU, dv / uGlowRadiusV));
  float falloff = smoothstep(1.0, 0.0, distGlow);

  float distSolid = length(vec2((du * uAspect) / uSolidRadiusU, dv / uSolidRadiusV));
  float solidFactor = smoothstep(1.0, 0.0, distSolid) * uGlowIntensity;

  vec3 withGlow = base.rgb + uGlowColor * uGlowIntensity * falloff * 0.25;
  vec3 glowed = mix(withGlow, uGlowColor, solidFactor);

  gl_FragColor = vec4(glowed, base.a);
}
`;

// Evita el parpadeo entre frente y reverso de la cinta
export function createGlowMaterial({
  map, side, aspect, sharedUniforms,
  glowRadiusU = 0.06, glowRadiusV = 0.018,
  solidRadiusU = glowRadiusU * 0.35, solidRadiusV = glowRadiusV * 0.35,
  polygonOffsetFactor = 0,
}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      uAspect: { value: aspect },
      uGlowColor: { value: new THREE.Color('#ffffff') },
      uGlowRadiusU: { value: glowRadiusU },
      uGlowRadiusV: { value: glowRadiusV },
      uSolidRadiusU: { value: solidRadiusU },
      uSolidRadiusV: { value: solidRadiusV },
      ...sharedUniforms,
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side,
    polygonOffset: true,
    polygonOffsetFactor,
    polygonOffsetUnits: polygonOffsetFactor,
  });
}
