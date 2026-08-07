import * as Tone from 'https://cdn.jsdelivr.net/npm/tone@14.8.49/+esm';
import { AUDIO } from './shared/config.js';

export function createAudioEngine({ transport, voiceIds }) {
  // Bus maestro: evita que la suma de voces sonando a la vez distorsione
  const masterLimiter = new Tone.Limiter(AUDIO.limiterThresholdDb).toDestination();

  const synths = {};

  voiceIds.forEach((voiceId) => {
    const synth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: AUDIO.maxPolyphony,
      oscillator: { type: AUDIO.oscillatorTypeByVoice[voiceId] ?? AUDIO.oscillatorType },
      envelope: AUDIO.envelope,
    }).connect(masterLimiter);
    synth.volume.value = AUDIO.volumeDb[voiceId] ?? -8;
    synths[voiceId] = synth;
  });

  async function init() {
    await Tone.start();
  }

  transport.on('noteStart', ({ voiceId, note, time }) => {
    const synth = synths[voiceId];
    if (!synth) return;
    const freq = Tone.Frequency(note.midi, 'midi').toFrequency();
    const durationTicks = note.tick_end - note.tick_start;
    synth.triggerAttackRelease(freq, `${durationTicks}i`, time);
  });

  return { init };
}
