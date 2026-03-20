'use client';

import { useEffect, useState } from 'react';
import { GlucoseIndicator } from '@ui/components/GlucoseIndicator/GlucoseIndicator';

interface LatestReading {
  valueMmolL: number;
  trend: string;
  timestamp: string;
}

interface StreamEnvelope {
  source?: string;
  reading?: LatestReading;
}

function normalizeStreamPayload(raw: string): LatestReading | null {
  try {
    const parsed = JSON.parse(raw) as StreamEnvelope | LatestReading;
    if ('reading' in parsed && parsed.reading) {
      return parsed.reading;
    }

    if ('valueMmolL' in parsed && 'trend' in parsed && 'timestamp' in parsed) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

export function DashboardGlucoseBadge() {
  const [latest, setLatest] = useState<LatestReading | null>(null);

  useEffect(() => {
    let mounted = true;
    let eventSource: EventSource | null = null;

    async function fetchLatest() {
      try {
        const res = await fetch('/api/dashboard/glucose/history?limit=1');
        if (!res.ok) return;
        const json = await res.json();
        if (mounted && json.latest) {
          setLatest(json.latest);
        }
      } catch {
        // Silent fail
      }
    }

    function publishLatest(reading: LatestReading) {
      setLatest(reading);
      window.dispatchEvent(new CustomEvent('pulse-glucose-latest', { detail: reading }));
    }

    function connectStream() {
      eventSource = new EventSource('/api/dashboard/glucose/stream');

      eventSource.addEventListener('glucose_update', (event) => {
        if (!mounted) {
          return;
        }

        const reading = normalizeStreamPayload((event as MessageEvent).data);
        if (reading) {
          publishLatest(reading);
        }
      });

      eventSource.addEventListener('stream_error', async () => {
        await fetchLatest();
      });
    }

    fetchLatest();
    connectStream();

    function handleEvent(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail && mounted) {
        setLatest(detail);
      }
    }

    window.addEventListener('pulse-glucose-latest', handleEvent);
    return () => {
      mounted = false;
      eventSource?.close();
      window.removeEventListener('pulse-glucose-latest', handleEvent);
    };
  }, []);

  if (!latest) return null;

  return (
    <GlucoseIndicator
      value={latest.valueMmolL}
      trend={latest.trend}
      timestamp={latest.timestamp}
      size="lg"
      showAge={false}
    />
  );
}
