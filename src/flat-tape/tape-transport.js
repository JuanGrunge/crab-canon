import { END_MARGIN_PX, TAPE_VISUAL_SCALE } from '../shared/config.js';
import { createTransportClock } from '../shared/transport-clock.js';

// Scroll DOM + margen de auto-stop sobre el reloj puro
export function createTapeTransport({ meta, voiceNotes, trackEls, tickToX, layout, playheadPx = 0 }) {
  const clock = createTransportClock({ meta, voiceNotes });

  const lastMeasureWidth = layout.measureWidths[layout.measureWidths.length - 1];
  const lastPxPerTick = lastMeasureWidth / layout.ticksPerMeasure;
  const stopEndTick = meta.total_ticks + END_MARGIN_PX / lastPxPerTick;

  let loopEnabled = false;

  function applyScrollPosition(currentTicks) {
    const pixels = Math.max(0, tickToX(currentTicks) * TAPE_VISUAL_SCALE - playheadPx);
    Object.values(trackEls).forEach((el) => {
      el.style.transform = `translateX(${-pixels}px)`;
    });
  }

  clock.on('tick', (currentTicks) => {
    applyScrollPosition(currentTicks);
    if (!loopEnabled && currentTicks >= stopEndTick) {
      clock.stop();
    }
  });

  function setLoop(enabled) {
    loopEnabled = enabled;
    clock.setLoop(enabled);
  }

  return {
    on: clock.on,
    play: clock.play,
    pause: clock.pause,
    stop: clock.stop,
    seek: clock.seek,
    setBpm: clock.setBpm,
    setLoop,
    getTicks: clock.getTicks,
    getState: clock.getState,
  };
}
