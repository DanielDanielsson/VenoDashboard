'use client';

type GlucoseStatRingSize = 'sm' | 'md' | 'lg';

interface GlucoseStatRingProps {
  label: string;
  percentage: number;
  color: string;
  size?: GlucoseStatRingSize;
}

const SIZE_CONFIG: Record<GlucoseStatRingSize, { diameter: number; stroke: number; fontSize: number; labelSize: number }> = {
  sm: { diameter: 44, stroke: 4, fontSize: 10, labelSize: 8 },
  md: { diameter: 62, stroke: 5, fontSize: 12, labelSize: 9 },
  lg: { diameter: 90, stroke: 7, fontSize: 16, labelSize: 10 },
};

export function GlucoseStatRing({ label, percentage, color, size = 'md' }: GlucoseStatRingProps) {
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
            stroke="rgba(148, 163, 184, 0.14)"
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
          fontSize: config.fontSize,
          fontWeight: 700,
          fontFamily: 'var(--font-plex-mono), monospace',
          color: 'var(--text)'
        }}>
          {normalized}%
        </div>
      </div>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 2 }}>
        <div style={{
          fontSize: config.labelSize,
          fontWeight: 700,
          color: 'var(--text-soft)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          textAlign: 'center',
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}
