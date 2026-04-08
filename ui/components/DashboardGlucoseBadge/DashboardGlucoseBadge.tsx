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

interface DashboardGlucoseBadgeProps {
  enableStream?: boolean;
  pollIntervalMs?: number;
}

export function DashboardGlucoseBadge({
  enableStream = true,
  pollIntervalMs = 60_000
}: DashboardGlucoseBadgeProps) {
  const [latest, setLatest] = useState<LatestReading | null>(null);

  useEffect(() => {
    let mounted = true;
    let eventSource: EventSource | null = null;
    let pollTimer: number | null = null;

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

    function startPolling() {
      if (pollTimer !== null) {
        return;
      }

      pollTimer = window.setInterval(() => {
        void fetchLatest();
      }, pollIntervalMs);
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
        startPolling();
      });

      eventSource.addEventListener('error', () => {
        eventSource?.close();
        startPolling();
      });
    }

    void fetchLatest();

    if (enableStream) {
      connectStream();
    } else {
      startPolling();
    }

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
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
      window.removeEventListener('pulse-glucose-latest', handleEvent);
    };
  }, [enableStream, pollIntervalMs]);

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
