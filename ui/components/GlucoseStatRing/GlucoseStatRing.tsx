'use client';

interface GlucoseStatRingProps {
  label: string;
  percentage: number;
  color: string;
}

const RADIUS = 28;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function GlucoseStatRing({ label, percentage, color }: GlucoseStatRingProps) {
  const normalized = Math.max(0, Math.min(100, percentage));
  const dashOffset = CIRCUMFERENCE * (1 - normalized / 100);

  return (
    <div style={{
      display: 'grid',
      justifyItems: 'center',
      gap: 6,
      minWidth: 92
    }}>
      <div style={{ position: 'relative', width: 74, height: 74 }}>
        <svg width="74" height="74" viewBox="0 0 74 74">
          <circle
            cx="37"
            cy="37"
            r={RADIUS}
            fill="none"
            stroke="rgba(148, 163, 184, 0.14)"
            strokeWidth="6"
          />
          <circle
            cx="37"
            cy="37"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 37 37)"
          />
        </svg>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'var(--font-plex-mono), monospace',
          color: 'var(--text)'
        }}>
          {normalized}%
        </div>
      </div>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 2 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-soft)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em'
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}
