import { GLOW } from '../shared/config.js';

const ATTACK_MS = GLOW.attackMs;
const RELEASE_MS = GLOW.releaseMs;

// Glow de la nota activa sobre la textura y el halo 3D
export function createMoebiusGlow({
  transport, uvMap, sharedUniforms, voiceId, halo, side,
  resolveUv = (note) => uvMap.get(note.tick_start),
}) {
  let start = null;

  function envelope(elapsed) {
    if (elapsed < ATTACK_MS) return elapsed / ATTACK_MS;
    const releaseElapsed = elapsed - ATTACK_MS;
    if (releaseElapsed < RELEASE_MS) return 1 - releaseElapsed / RELEASE_MS;
    return 0;
  }

  function tick(now) {
    if (start === null) return;
    const elapsed = now - start;
    const total = ATTACK_MS + RELEASE_MS;
    if (elapsed >= total) {
      sharedUniforms.uGlowIntensity.value = 0;
      if (halo) halo.sprite.material.opacity = 0;
      start = null;
      return;
    }
    const intensity = envelope(elapsed);
    sharedUniforms.uGlowIntensity.value = intensity;
    if (halo) {
      halo.setState({
        u: sharedUniforms.uActiveUV.value.x,
        v: sharedUniforms.uActiveUV.value.y,
        color: GLOW.colorByVoice[voiceId],
        intensity,
        side,
      });
    }
  }

  function trigger(uv) {
    sharedUniforms.uActiveUV.value.set(uv.u, uv.v);
    start = performance.now();
  }

  transport.on('noteStart', ({ voiceId: eventVoiceId, note }) => {
    if (eventVoiceId !== voiceId) return;
    const uv = resolveUv(note);
    if (!uv) return;
    sharedUniforms.uGlowColor.value.set(GLOW.colorByVoice[voiceId]);
    trigger(uv);
  });

  transport.on('tick', () => tick(performance.now()));
}
