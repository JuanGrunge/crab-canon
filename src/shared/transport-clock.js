import * as Tone from 'https://cdn.jsdelivr.net/npm/tone@14.8.49/+esm';
import { BPM } from './config.js';

// Reloj puro: agenda de notas + loop exacto, sin DOM
export function createTransportClock({ meta, voiceNotes }) {
  Tone.Transport.PPQ = meta.ticks_per_beat;
  Tone.Transport.bpm.value = BPM;

  const listeners = { noteStart: [], tick: [] };
  let rafId = null;
  let running = false;
  let loopEnabled = false;
  let state = 'stopped';
  let noteEventIds = [];

  const loopEndTick = meta.total_ticks;

  function scheduleAllNotes() {
    Object.entries(voiceNotes).forEach(([voiceId, notes]) => {
      notes.forEach((note) => {
        const id = Tone.Transport.schedule((time) => {
          listeners.noteStart.forEach((handler) => handler({ voiceId, note, tick: note.tick_start, time }));
        }, `${note.tick_start}i`);
        noteEventIds.push(id);
      });
    });
  }

  function clearScheduledNotes() {
    noteEventIds.forEach((id) => Tone.Transport.clear(id));
    noteEventIds = [];
  }

  scheduleAllNotes();

  function emitTick(ticks) {
    listeners.tick.forEach((handler) => handler(ticks));
  }

  function tickLoop() {
    const currentTicks = Tone.Transport.ticks;
    emitTick(currentTicks);
    if (!running) return;
    rafId = requestAnimationFrame(tickLoop);
  }

  function on(eventName, handler) {
    listeners[eventName].push(handler);
  }

  function play() {
    Tone.Transport.start();
    state = 'playing';
    if (!running) {
      running = true;
      tickLoop();
    }
  }

  function pause() {
    Tone.Transport.pause();
    running = false;
    state = 'paused';
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function stop() {
    Tone.Transport.stop();
    clearScheduledNotes();
    scheduleAllNotes();
    running = false;
    state = 'stopped';
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    emitTick(0);
  }

  function seek(tick) {
    Tone.Transport.ticks = tick;
    emitTick(tick);
  }

  function setLoop(enabled) {
    loopEnabled = enabled;
    Tone.Transport.loop = enabled;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = `${loopEndTick}i`;
  }

  function setBpm(value) {
    Tone.Transport.bpm.value = value;
  }

  function getTicks() {
    return Tone.Transport.ticks;
  }

  function getState() {
    return state;
  }

  return { on, play, pause, stop, seek, setLoop, setBpm, getTicks, getState, loopEndTick };
}
