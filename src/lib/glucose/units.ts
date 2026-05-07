export type GlucoseUnit = 'mmol/L' | 'mg/dL';

export const GLUCOSE_UNITS = [
  { value: 'mmol/L', label: 'mmol/l' },
  { value: 'mg/dL', label: 'mg/dl' },
] as const satisfies readonly [
  {
    value: GlucoseUnit;
    label: string;
  },
  {
    value: GlucoseUnit;
    label: string;
  },
  ...Array<{
    value: GlucoseUnit;
    label: string;
  }>,
];

const MG_DL_PER_MMOL_L = 18.0182;

export function convertGlucoseValue(
  value: number,
  from: GlucoseUnit,
  to: GlucoseUnit,
): number {
  if (from === to) {
    return value;
  }

  return from === 'mmol/L'
    ? value * MG_DL_PER_MMOL_L
    : value / MG_DL_PER_MMOL_L;
}

export function formatGlucoseValue(
  valueMmolL: number,
  unit: GlucoseUnit,
): string {
  if (unit === 'mg/dL') {
    return String(Math.round(convertGlucoseValue(valueMmolL, 'mmol/L', unit)));
  }

  return valueMmolL.toFixed(1);
}

export function formatGlucoseDeltaValue(
  deltaMmolL: number,
  unit: GlucoseUnit,
): string {
  const value = unit === 'mg/dL'
    ? Math.round(convertGlucoseValue(deltaMmolL, 'mmol/L', unit))
    : Number(deltaMmolL.toFixed(1));

  if (Object.is(value, -0) || value === 0) {
    return unit === 'mg/dL' ? '0' : '0.0';
  }

  return value > 0 ? `+${value}` : String(value);
}
