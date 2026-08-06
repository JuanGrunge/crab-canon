// Fuente de datos
export const DATA_URL = '/data/voice-data.json';

// Tempo
export const BPM = 120;
export const BPM_MIN = 80;
export const BPM_MAX = 120;

// Layout de la cinta
export const STRIP_HEIGHT = 150;
export const STRIP_GAP = 24;
export const STAVE_MARGIN_LEFT = 40;
export const STAVE_TOP = 10;
export const MEASURE_PADDING_PX = 24;
export const CLEF = 'treble';
export const END_MARGIN_PX = 48;

// Colchón extra para el último compás
export const LAST_MEASURE_SAFETY_PX = 24;

// Aire tras la última nota de cada compás
export const TRAILING_PAD_PX = 32;

// Posición del cabezal de lectura (fracción del viewport)
export const PLAYHEAD_X = 0.3;

// Escala visual de la cinta plana
export const TAPE_VISUAL_SCALE = 0.66;

// Escala px→mundo de la cinta Moebius
export const MOEBIUS_PX_TO_WORLD_SCALE = 0.018394;

// Voces
export const VOICES = {
  voice_1: {
    id: 'voice_1',
    label: 'Voz 1',
    background: '#0a0a0a',
    noteColor: '#f5f5f5',
    staffColor: '#f5f5f5',
  },
  voice_2: {
    id: 'voice_2',
    label: 'Voz 2',
    background: '#0a0a0a',
    noteColor: '#f5f5f5',
    staffColor: '#f5f5f5',
  },
};

// Glow LED — color por voz
export const GLOW = {
  colorByVoice: {
    voice_1: '#ff6a00',
    voice_2: '#00e5ff',
  },
  attackMs: 40,
  sustainOpacity: 1,
  releaseMs: 900,
  maxBlur: 18,
};

// Audio (clavecín pulsado)
export const AUDIO = {
  oscillatorType: 'triangle',
  oscillatorTypeByVoice: {
    voice_1: 'triangle',
    voice_2: 'triangle8',
  },
  envelope: {
    attack: 0.005,
    decay: 0.12,
    sustain: 0.05,
    release: 1.3,
  },
  volumeDb: {
    voice_1: -8,
    voice_2: -8,
  },
};
