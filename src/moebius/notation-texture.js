import * as THREE from 'three';
import { Renderer } from 'https://cdn.jsdelivr.net/npm/vexflow@4.2.3/+esm';

import { DATA_URL, VOICES, STRIP_HEIGHT } from '../shared/config.js';
import { renderMeasureRange } from '../shared/notation-renderer.js';

const CANVAS_WIDTH = 4096;

// Textura de notación para una porción de compases de una voz
export async function buildHalfNotationTexture({ layout, meta, measureStart, measureEnd, verticalOffset = 0, voiceId = 'voice_1' }) {
  const response = await fetch(DATA_URL);
  const data = await response.json();
  const notes = data[voiceId];
  const palette = VOICES[voiceId];

  const segmentStartX = layout.measureX[measureStart];
  const segmentWidth = layout.measureWidths
    .slice(measureStart, measureEnd)
    .reduce((a, b) => a + b, 0);

  const scale = CANVAS_WIDTH / segmentWidth;
  const canvasHeight = Math.round(STRIP_HEIGHT * scale);

  const canvas = document.createElement('canvas');
  const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
  renderer.resize(CANVAS_WIDTH, canvasHeight);

  const ctx2d = canvas.getContext('2d');
  ctx2d.fillStyle = palette.background;
  ctx2d.fillRect(0, 0, CANVAS_WIDTH, canvasHeight);
  ctx2d.setTransform(scale, 0, 0, scale, -segmentStartX * scale, verticalOffset * scale);

  const uvMap = new Map();

  renderMeasureRange({
    context: renderer.getContext(),
    meta,
    layout,
    notes,
    voiceId,
    measureStart,
    measureEnd,
    drawEndBarline: false,
    drawStartClef: false,
    trailingPadPx: 0,
    palette,
    onNoteRendered: ({ segment, staveNote }) => {
      const logicalX = staveNote.getAbsoluteX();
      const ys = typeof staveNote.getYs === 'function' ? staveNote.getYs() : null;
      const logicalY = ys && ys.length ? ys[0] : STRIP_HEIGHT / 2;

      const u = (logicalX - segmentStartX) / segmentWidth;
      const v = 1 - Math.min(Math.max((logicalY + verticalOffset) / STRIP_HEIGHT, 0), 1);
      uvMap.set(segment.originalTickStart, { u, v });
    },
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return { texture, uvMap, segmentWidth };
}
