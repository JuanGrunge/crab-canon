import { Renderer } from 'https://cdn.jsdelivr.net/npm/vexflow@4.2.3/+esm';

import { STRIP_HEIGHT, TAPE_VISUAL_SCALE } from '../shared/config.js';
import { renderMeasureRange } from '../shared/notation-renderer.js';

export function renderVoice(notes, meta, voiceConfig, containerEl, layout) {
  const { measureCount, totalContentWidth } = layout;

  const totalWidth = totalContentWidth + 40;
  const totalHeight = STRIP_HEIGHT;

  const renderer = new Renderer(containerEl, Renderer.Backends.SVG);
  renderer.resize(totalWidth, totalHeight);
  const context = renderer.getContext();

  const svgEl = containerEl.querySelector('svg');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', 0);
  rect.setAttribute('y', 0);
  rect.setAttribute('width', totalWidth);
  rect.setAttribute('height', totalHeight);
  rect.setAttribute('fill', voiceConfig.background);
  svgEl.appendChild(rect);

  const noteMap = new Map();

  renderMeasureRange({
    context,
    meta,
    layout,
    notes,
    voiceId: voiceConfig.id,
    measureStart: 0,
    measureEnd: measureCount,
    drawEndBarline: true,
    palette: voiceConfig,
    onNoteRendered: ({ segment, staveNote }) => {
      const id = staveNote.getAttribute('id');
      // Nodo DOM real de la nota
      const el = containerEl.querySelector(`#vf-${id}`);
      const headEl = el ? el.querySelector('.vf-notehead') || el : el;
      noteMap.set(segment.originalTickStart, { el: headEl });
    },
  });

  // Escala visual de presentación
  svgEl.style.transformOrigin = 'top left';
  svgEl.style.transform = `scale(${TAPE_VISUAL_SCALE})`;

  return noteMap;
}
