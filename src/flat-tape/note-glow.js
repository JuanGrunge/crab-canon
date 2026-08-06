import { GLOW, VOICES } from '../shared/config.js';

export function createNoteGlow({ transport, noteMaps, meta }) {
  const activeAnimations = new WeakMap();

  function trigger(voiceId, tick) {
    const noteMap = noteMaps[voiceId];
    const entry = noteMap && noteMap.get(tick);
    if (!entry || !entry.el) return;

    const existing = activeAnimations.get(entry.el);
    if (existing) existing.cancel();

    const color = GLOW.colorByVoice[voiceId];
    const originalColor = VOICES[voiceId].noteColor;
    const total = GLOW.attackMs + GLOW.releaseMs;
    const peakOffset = GLOW.attackMs / total;
    const animation = entry.el.animate(
      [
        { filter: `drop-shadow(0 0 0px ${color})`, fill: originalColor, offset: 0 },
        { filter: `drop-shadow(0 0 ${GLOW.maxBlur}px ${color})`, fill: color, offset: peakOffset },
        { filter: `drop-shadow(0 0 0px ${color})`, fill: originalColor, offset: 1 },
      ],
      { duration: total, easing: 'linear', fill: 'forwards' },
    );
    activeAnimations.set(entry.el, animation);
  }

  transport.on('noteStart', ({ voiceId, tick }) => trigger(voiceId, tick));

  return { trigger };
}
