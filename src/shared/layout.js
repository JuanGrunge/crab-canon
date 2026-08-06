import {
  Stave,
  StaveNote,
  Barline,
} from 'https://cdn.jsdelivr.net/npm/vexflow@4.2.3/+esm';

import { CLEF, STAVE_MARGIN_LEFT, MEASURE_PADDING_PX, LAST_MEASURE_SAFETY_PX } from './config.js';

// Duración VexFlow por duration_beats
const DURATION_TABLE = [
  [4, 'w'],
  [3, 'hd'],
  [2, 'h'],
  [1.5, 'qd'],
  [1, 'q'],
  [0.75, '8d'],
  [0.5, '8'],
  [0.375, '16d'],
  [0.25, '16'],
  [0.125, '32'],
];

function beatsToDuration(beats) {
  const match = DURATION_TABLE.find(([b]) => Math.abs(b - beats) < 1e-6);
  if (!match) {
    throw new Error(`No hay mapeo VexFlow para duration_beats=${beats}`);
  }
  return match[1];
}

function nameToVexKey(name) {
  const parsed = name.match(/^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/);
  if (!parsed) {
    throw new Error(`No se pudo interpretar el nombre de nota "${name}"`);
  }
  const [, letter, accidental = '', octave] = parsed;
  return `${letter.toLowerCase()}${accidental}/${octave}`;
}

// Parte notas que cruzan compás (ligaduras)
function expandTiedNotes(notes, ticksPerMeasure, ticksPerBeat) {
  const segments = [];
  notes.forEach((note, index) => {
    let start = note.tick_start;
    const end = note.tick_end;
    const tieGroupId = `tie-${index}-${note.tick_start}`;
    let isPrimary = true;
    for (;;) {
      const measureIndex = Math.floor(start / ticksPerMeasure);
      const measureBoundary = (measureIndex + 1) * ticksPerMeasure;
      const segEnd = Math.min(end, measureBoundary);
      const tiesToNext = segEnd < end;
      segments.push({
        midi: note.midi,
        name: note.name,
        tick_start: start,
        tick_end: segEnd,
        duration_beats: (segEnd - start) / ticksPerBeat,
        originalTickStart: note.tick_start,
        isPrimary,
        tieGroupId,
        tiesToNext,
        isRest: false,
      });
      if (!tiesToNext) break;
      start = segEnd;
      isPrimary = false;
    }
  });
  return segments;
}

function buildMeasures(segments, ticksPerMeasure) {
  const measures = new Map();
  for (const segment of segments) {
    const measureIndex = Math.floor(segment.tick_start / ticksPerMeasure);
    if (!measures.has(measureIndex)) measures.set(measureIndex, []);
    measures.get(measureIndex).push(segment);
  }
  return measures;
}

// Descompone un hueco en silencios válidos
function restsForGap(start, end, ticksPerBeat) {
  const rests = [];
  let cursor = start;
  while (end - cursor > 1e-6) {
    const remainingBeats = (end - cursor) / ticksPerBeat;
    const [beats] = DURATION_TABLE.find(([b]) => b <= remainingBeats + 1e-6);
    const ticks = beats * ticksPerBeat;
    rests.push({
      tick_start: cursor,
      tick_end: cursor + ticks,
      duration_beats: beats,
      isRest: true,
    });
    cursor += ticks;
  }
  return rests;
}

// Rellena un compás con silencios explícitos
function fillMeasureWithRests(measureIndex, segments, ticksPerMeasure, ticksPerBeat) {
  const measureStart = measureIndex * ticksPerMeasure;
  const measureEnd = measureStart + ticksPerMeasure;
  const sorted = [...segments].sort((a, b) => a.tick_start - b.tick_start);
  const filled = [];
  let cursor = measureStart;
  sorted.forEach((segment) => {
    if (segment.tick_start > cursor) {
      filled.push(...restsForGap(cursor, segment.tick_start, ticksPerBeat));
    }
    filled.push(segment);
    cursor = Math.max(cursor, segment.tick_end);
  });
  if (cursor < measureEnd) {
    filled.push(...restsForGap(cursor, measureEnd, ticksPerBeat));
  }
  return filled;
}

// Segmentos finales por compás (ligaduras + silencios)
export function prepareVoiceMeasures(notes, meta, measureCountOverride) {
  const ticksPerMeasure = meta.ticks_per_beat * Number(meta.time_signature.split('/')[0]);
  const ticksPerBeat = meta.ticks_per_beat;
  const expanded = expandTiedNotes(notes, ticksPerMeasure, ticksPerBeat);
  const grouped = buildMeasures(expanded, ticksPerMeasure);
  const naturalCount = grouped.size > 0 ? Math.max(...grouped.keys()) + 1 : 0;
  const measureCount = measureCountOverride ?? naturalCount;

  const segmentsByMeasure = new Map();
  for (let m = 0; m < measureCount; m += 1) {
    const raw = grouped.get(m) || [];
    segmentsByMeasure.set(m, fillMeasureWithRests(m, raw, ticksPerMeasure, ticksPerBeat));
  }
  return { ticksPerMeasure, measureCount, segmentsByMeasure };
}

// StaveNote (notas y silencios) para segmentos ya preparados
export function buildStaveNotesForSegments(segments, voiceIdentity) {
  return segments.map((segment) => {
    if (segment.isRest) {
      const staveNote = new StaveNote({
        keys: ['b/4'],
        duration: `${beatsToDuration(segment.duration_beats)}r`,
        clef: CLEF,
      });
      staveNote.setStyle({ fillStyle: voiceIdentity.noteColor, strokeStyle: voiceIdentity.noteColor });
      return { segment, staveNote };
    }
    const key = nameToVexKey(segment.name);
    const staveNote = new StaveNote({
      keys: [key],
      duration: beatsToDuration(segment.duration_beats),
      clef: CLEF,
    });
    staveNote.setStyle({ fillStyle: voiceIdentity.noteColor, strokeStyle: voiceIdentity.noteColor });
    if (segment.isPrimary) {
      staveNote.setAttribute('id', `note-${voiceIdentity.id}-${segment.originalTickStart}`);
    }
    return { segment, staveNote };
  });
}

// Ancho de clave + armadura + compás (sonda descartable)
function measureModifierReserve(meta) {
  const probe = new Stave(0, 0, 500);
  probe.addClef(CLEF).addKeySignature(meta.key_signature).addTimeSignature(meta.time_signature);
  return probe.getNoteStartX() - probe.getX();
}

// Ancho extra de la barra final (sonda descartable)
function endBarlineReserve() {
  const probeWidth = 500;
  const probe = new Stave(0, 0, probeWidth);
  probe.setEndBarType(Barline.type.END);
  return probe.getX() + probeWidth - probe.getNoteEndX();
}

function minWidthForMeasure(segments) {
  if (segments.length === 0) return 0;
  const BASE_WIDTH_PX = 20;
  const PER_SEGMENT_WIDTH_PX = 55;
  const ACCIDENTAL_EXTRA_PX = 14;
  const accidentalCount = segments.filter((s) => !s.isRest && /[#b]/.test(s.name || '')).length;
  return BASE_WIDTH_PX + segments.length * PER_SEGMENT_WIDTH_PX + accidentalCount * ACCIDENTAL_EXTRA_PX;
}

// Layout del sistema de dos voces (cinta plana y Moebius)
export function computeLayout(voiceNotesByVoice, meta, {
  includeClefReserve = true,
  includeEndReserve = true,
  includeLeftMargin = true,
} = {}) {
  const beatsPerMeasure = Number(meta.time_signature.split('/')[0]);
  const beatValue = Number(meta.time_signature.split('/')[1]);
  const ticksPerMeasure = meta.ticks_per_beat * beatsPerMeasure;

  let measureCount = 0;
  Object.values(voiceNotesByVoice).forEach((notes) => {
    const maxTick = notes.reduce((max, n) => Math.max(max, n.tick_end), 0);
    measureCount = Math.max(measureCount, Math.ceil(maxTick / ticksPerMeasure));
  });

  const prepared = {};
  Object.entries(voiceNotesByVoice).forEach(([voiceId, notes]) => {
    prepared[voiceId] = prepareVoiceMeasures(notes, meta, measureCount);
  });

  const firstMeasureReserve = includeClefReserve ? measureModifierReserve(meta) : 0;
  const lastMeasureReserve = includeEndReserve ? endBarlineReserve() : 0;

  const measureWidths = [];
  for (let m = 0; m < measureCount; m += 1) {
    let maxMinWidth = 0;
    Object.entries(prepared).forEach(([voiceId, p]) => {
      const segments = p.segmentsByMeasure.get(m) || [];
      const minWidth = minWidthForMeasure(segments);
      maxMinWidth = Math.max(maxMinWidth, minWidth);
    });
    let width = maxMinWidth + MEASURE_PADDING_PX;
    if (m === 0) width += firstMeasureReserve;
    if (m === measureCount - 1) width += includeEndReserve ? lastMeasureReserve + LAST_MEASURE_SAFETY_PX : 0;
    measureWidths.push(width);
  }

  const measureX = [];
  let cursor = includeLeftMargin ? STAVE_MARGIN_LEFT : 0;
  for (let m = 0; m < measureCount; m += 1) {
    measureX.push(cursor);
    cursor += measureWidths[m];
  }

  return {
    ticksPerMeasure,
    beatsPerMeasure,
    beatValue,
    measureCount,
    measureWidths,
    measureX,
    totalContentWidth: cursor,
  };
}

// Mapeo tick -> posición x
export function createTickToXMapper(layout) {
  const { ticksPerMeasure, measureCount, measureWidths, measureX, totalContentWidth } = layout;
  const lastWidth = measureWidths[measureWidths.length - 1] ?? ticksPerMeasure;
  const lastPxPerTick = lastWidth / ticksPerMeasure;
  const boundaryTick = measureCount * ticksPerMeasure;

  return function tickToX(tick) {
    if (tick >= boundaryTick) {
      return totalContentWidth + (tick - boundaryTick) * lastPxPerTick;
    }
    const measureIndex = Math.min(Math.floor(tick / ticksPerMeasure), measureCount - 1);
    const tickOffset = tick - measureIndex * ticksPerMeasure;
    const ratio = tickOffset / ticksPerMeasure;
    return measureX[measureIndex] + ratio * measureWidths[measureIndex];
  };
}
