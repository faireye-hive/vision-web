export type ReadingSize = 'sm' | 'md' | 'lg' | 'xl';
export type ReadingFamily = 'system' | 'serif' | 'mono';
export type ReadingTone = 'default' | 'ink' | 'warm' | 'contrast';
export type ReadingAmbient =
  | 'default'
  | 'paper'
  | 'mist'
  | 'pine'
  | 'sand'
  | 'rose'
  | 'sky'
  | 'ink'
  | 'ember'
  | 'ocean'
  | 'violet';

export interface ReadingStyle {
  size: ReadingSize;
  family: ReadingFamily;
  tone: ReadingTone;
  ambient: ReadingAmbient;
}

export const READING_STYLE_KEY = 'nebulosa_reading_style';

export const DEFAULT_READING_STYLE: ReadingStyle = {
  size: 'md',
  family: 'system',
  tone: 'default',
  ambient: 'default',
};

const SIZE_PX: Record<ReadingSize, string> = {
  sm: '15px',
  md: '16px',
  lg: '18px',
  xl: '20px',
};

const FAMILY_STACK: Record<ReadingFamily, string> = {
  system: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
  serif: `Georgia, 'Iowan Old Style', 'Palatino Linotype', Palatino, serif`,
  mono: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
};

const LIGHT_BG: Record<ReadingAmbient, string> = {
  default: '#f7f8fa',
  paper: '#f6f1e7',
  mist: '#eef3f7',
  pine: '#e7f0ea',
  sand: '#f8f1e3',
  rose: '#f8eef1',
  sky: '#eaf3fb',
  ink: '#e8eaee',
  ember: '#f8efe8',
  ocean: '#e7f1f4',
  violet: '#f1eef8',
};

const DARK_BG: Record<ReadingAmbient, string> = {
  default: '#0b0f17',
  paper: '#17140f',
  mist: '#101820',
  pine: '#0d1612',
  sand: '#1c1812',
  rose: '#1a1014',
  sky: '#0c1520',
  ink: '#07090d',
  ember: '#140e0b',
  ocean: '#07141c',
  violet: '#100c18',
};

const LIGHT_TEXT: Record<ReadingTone, string> = {
  default: '#1e293b',
  ink: '#0f172a',
  warm: '#44403c',
  contrast: '#000000',
};

const DARK_TEXT: Record<ReadingTone, string> = {
  default: '#f1f5f9',
  ink: '#f8fafc',
  warm: '#f5f0e8',
  contrast: '#ffffff',
};

export function readReadingStyle(): ReadingStyle {
  try {
    const raw = localStorage.getItem(READING_STYLE_KEY);
    if (!raw) return DEFAULT_READING_STYLE;
    const parsed = JSON.parse(raw) as Partial<ReadingStyle>;
    return {
      size: parsed.size && parsed.size in SIZE_PX ? parsed.size : 'md',
      family: parsed.family && parsed.family in FAMILY_STACK ? parsed.family : 'system',
      tone: parsed.tone && parsed.tone in LIGHT_TEXT ? parsed.tone : 'default',
      ambient: parsed.ambient && parsed.ambient in LIGHT_BG ? parsed.ambient : 'default',
    };
  } catch {
    return DEFAULT_READING_STYLE;
  }
}

export function applyReadingStyle(style: ReadingStyle, mode: 'light' | 'dark'): void {
  const root = document.documentElement;
  const dark = mode === 'dark';
  root.dataset.readingSize = style.size;
  root.dataset.readingFamily = style.family;
  root.dataset.readingTone = style.tone;
  root.dataset.readingAmbient = style.ambient;
  const fontSize = SIZE_PX[style.size];
  const fontFamily = FAMILY_STACK[style.family];
  const background = (dark ? DARK_BG : LIGHT_BG)[style.ambient];
  const text = (dark ? DARK_TEXT : LIGHT_TEXT)[style.tone];
  root.style.setProperty('--reading-font-size', fontSize);
  root.style.setProperty('--reading-font-family', fontFamily);
  root.style.setProperty('--ambient-bg', background);
  root.style.setProperty('--reading-text', text);
  root.style.fontSize = fontSize;
  root.style.fontFamily = fontFamily;
  document.body.style.backgroundColor = background;
  document.body.style.color = text;
  try {
    localStorage.setItem(READING_STYLE_KEY, JSON.stringify(style));
  } catch {
    // Private mode can block storage. The variables still apply for this tab.
  }
}
