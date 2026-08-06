import {
  Stave,
  Voice,
  Formatter,
  Accidental,
  Barline,
  Beam,
  StaveTie,
} from 'https://cdn.jsdelivr.net/npm/vexflow@4.2.3/+esm';

import { CLEF, STAVE_TOP, TRAILING_PAD_PX } from './config.js';
import { prepareVoiceMeasures, buildStaveNotesForSegments } from './layout.js';

// Motor de notación compartido entre la cinta plana y la Moebius
export function renderMeasureRange({
  context,
  meta,
  layout,
  notes,
  voiceId,
  palette,
  measureStart,
  measureEnd,
  drawEndBarline = false,
  drawStartClef = true,
  trailingPadPx = TRAILING_PAD_PX,
  onNoteRendered,
}) {
  const prepared = prepareVoiceMeasures(notes, meta, layout.measureCount);
  const pendingTieStarts = new Map();

  for (let m = measureStart; m < measureEnd; m += 1) {
    context.setFillStyle(palette.staffColor);
    context.setStrokeStyle(palette.staffColor);

    const stave = new Stave(layout.measureX[m], STAVE_TOP, layout.measureWidths[m]);
    if (m === 0 && drawStartClef) {
      stave.addClef(CLEF).addKeySignature(meta.key_signature).addTimeSignature(meta.time_signature);
    }
    if (drawEndBarline && m === measureEnd - 1) {
      stave.setEndBarType(Barline.type.END);
    }
    stave.setContext(context).draw();

    const segments = prepared.segmentsByMeasure.get(m) || [];
    const built = buildStaveNotesForSegments(segments, { id: voiceId, noteColor: palette.noteColor });

    if (built.length > 0) {
      const staveNotes = built.map((n) => n.staveNote);
      const voice = new Voice({ num_beats: layout.beatsPerMeasure, beat_value: layout.beatValue }).setMode(Voice.Mode.SOFT);
      voice.addTickables(staveNotes);

      context.setFillStyle(palette.noteColor);
      context.setStrokeStyle(palette.noteColor);

      Accidental.applyAccidentals([voice], meta.key_signature);

      const availableWidth = stave.getNoteEndX() - stave.getNoteStartX();
      const formatWidth = Math.max(availableWidth - trailingPadPx, 0);
      new Formatter().joinVoices([voice]).format([voice], formatWidth);

      const beams = Beam.generateBeams(staveNotes);
      voice.draw(context, stave);
      beams.forEach((beam) => beam.setContext(context).draw());

      built.forEach(({ segment, staveNote }) => {
        if (segment.isRest) return;
        if (!segment.isPrimary && pendingTieStarts.has(segment.tieGroupId)) {
          const firstHalf = pendingTieStarts.get(segment.tieGroupId);
          new StaveTie({
            first_note: firstHalf,
            last_note: staveNote,
            first_indices: [0],
            last_indices: [0],
          })
            .setContext(context)
            .draw();
          pendingTieStarts.delete(segment.tieGroupId);
        }
        if (segment.tiesToNext) {
          pendingTieStarts.set(segment.tieGroupId, staveNote);
        }
      });
    }

    if (onNoteRendered) {
      built.forEach(({ segment, staveNote }) => {
        if (segment.isRest || !segment.isPrimary) return;
        onNoteRendered({ segment, staveNote, measureIndex: m });
      });
    }
  }
}
