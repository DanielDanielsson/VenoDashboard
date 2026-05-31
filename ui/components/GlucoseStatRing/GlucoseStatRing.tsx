'use client';

import { twMerge } from 'tailwind-merge';

type GlucoseStatRingSize = 'sm' | 'md' | 'lg';

interface GlucoseStatRingProps {
  label: string;
  percentage: number;
  color: string;
  size?: GlucoseStatRingSize;
}

const SIZE_CONFIG: Record<GlucoseStatRingSize, { diameter: number; stroke: number; valueClassName: string; labelClassName: string }> = {
  sm: { diameter: 44, stroke: 4, valueClassName: 'ui_ring_value_sm', labelClassName: 'ui_ring_label' },
  md: { diameter: 62, stroke: 5, valueClassName: 'ui_ring_value_md', labelClassName: 'ui_ring_label' },
  lg: { diameter: 90, stroke: 7, valueClassName: 'ui_ring_value_lg', labelClassName: 'ui_ring_label' },
};

export const GlucoseStatRing = ({ label, percentage, color, size = 'md' }: GlucoseStatRingProps) => {
  const config = SIZE_CONFIG[size];
  const radius = (config.diameter - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalized = Math.max(0, Math.min(100, percentage));
  const dashOffset = circumference * (1 - normalized / 100);
  const center = config.diameter / 2;

  return (
    <div style={{
      display: 'grid',
      justifyItems: 'center',
      gap: 16,
    }}>
      <div style={{ position: 'relative', width: config.diameter, height: config.diameter }}>
        <svg width={config.diameter} height={config.diameter} viewBox={`0 0 ${config.diameter} ${config.diameter}`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth={config.stroke}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={config.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        </svg>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
        }} className={twMerge(config.valueClassName, 'text-text')}>
          {normalized}%
        </div>
      </div>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 2 }}>
        <div className={twMerge(config.labelClassName, 'text-text-soft')} style={{ textAlign: 'center' }}>
          {label}
        </div>
      </div>
    </div>
  );
};
