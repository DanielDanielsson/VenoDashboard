export type GlucoseColorMode = 'threeColors' | 'gradient';

export const GLUCOSE_COLOR_MODES: ReadonlyArray<{
  value: GlucoseColorMode;
  label: string;
}> = [
  { value: 'threeColors', label: '3 colors' },
  { value: 'gradient', label: 'Gradient' }
];

const LOW_THRESHOLD_MMOL_L = 4.0;
const TARGET_MMOL_L = 110 / 18;
const HIGH_THRESHOLD_MMOL_L = 10.0;

const LOW_COLOR_DARK   = '#fb7185';
const LOW_COLOR_LIGHT  = '#be123c';
const NORMAL_COLOR_DARK   = '#34d399';
const NORMAL_COLOR_LIGHT  = '#059669';
const HIGH_COLOR_DARK  = '#a855f7';
const HIGH_COLOR_LIGHT = '#7e22ce';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function toRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getGlucoseHue(valueMmolL: number): number {
  const redHue = 0;
  const greenHue = 120;
  const purpleHue = 270;

  if (valueMmolL <= LOW_THRESHOLD_MMOL_L) {
    return redHue;
  }

  if (valueMmolL >= HIGH_THRESHOLD_MMOL_L) {
    return purpleHue;
  }

  if (valueMmolL <= TARGET_MMOL_L) {
    const ratio = (valueMmolL - LOW_THRESHOLD_MMOL_L) / Math.max(0.0001, TARGET_MMOL_L - LOW_THRESHOLD_MMOL_L);
    return redHue + ratio * (greenHue - redHue);
  }

  const ratio = (valueMmolL - TARGET_MMOL_L) / Math.max(0.0001, HIGH_THRESHOLD_MMOL_L - TARGET_MMOL_L);
  return greenHue + ratio * (purpleHue - greenHue);
}

export function getGlucoseColor(valueMmolL: number, mode: GlucoseColorMode, alpha = 1, isDark = true): string {
  if (mode === 'threeColors') {
    const low    = isDark ? LOW_COLOR_DARK    : LOW_COLOR_LIGHT;
    const normal = isDark ? NORMAL_COLOR_DARK : NORMAL_COLOR_LIGHT;
    const high   = isDark ? HIGH_COLOR_DARK   : HIGH_COLOR_LIGHT;

    if (valueMmolL < LOW_THRESHOLD_MMOL_L)  return toRgba(low, alpha);
    if (valueMmolL > HIGH_THRESHOLD_MMOL_L) return toRgba(high, alpha);
    return toRgba(normal, alpha);
  }

  return `hsla(${getGlucoseHue(valueMmolL)} 60% 54% / ${alpha})`;
}
