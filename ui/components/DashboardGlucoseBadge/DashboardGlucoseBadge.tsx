'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { twMerge } from 'tailwind-merge';
import type { GlucoseColorMode } from '@/lib/glucose/tints';
import {
  formatGlucoseDeltaValue,
  formatGlucoseValue,
  type GlucoseUnit,
} from '@/lib/glucose/units';
import { DataFreshnessLight } from '@ui/components/DataFreshnessLight/DataFreshnessLight';
import { GlucoseIndicator } from '@ui/components/GlucoseIndicator/GlucoseIndicator';

interface LatestReading {
  id?: string;
  valueMmolL: number;
  trend: string;
  timestamp: string;
}

interface ChartPoint {
  readingId?: string;
  valueMmolL: number;
  timestamp: string;
}

interface HistoryResponse {
  items?: ChartPoint[];
  latest?: LatestReading | null;
}

interface StreamEnvelope {
  source?: string;
  reading?: LatestReading;
}

interface ReadingState {
  latest: LatestReading;
  previous: ChartPoint | LatestReading | null;
}

let cachedReadingState: ReadingState | null = null;

const normalizeStreamPayload = (raw: string): LatestReading | null => {
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
};

const getReadingKey = (
  reading: Pick<LatestReading, 'timestamp'> & {
    id?: string;
    readingId?: string;
  },
): string => {
  return reading.id ?? reading.readingId ?? reading.timestamp;
};

const pickPreviousReading = (
  latest: LatestReading,
  items: ChartPoint[] | undefined,
): ChartPoint | null => {
  const latestKey = getReadingKey(latest);

  return (
    (items ?? [])
      .filter((item) => getReadingKey(item) !== latestKey)
      .sort(
        (left, right) =>
          new Date(right.timestamp).getTime() -
          new Date(left.timestamp).getTime(),
      )[0] ?? null
  );
};

const updateReadingStateWithLatest = (
  current: ReadingState | null,
  latest: LatestReading,
  previous: ChartPoint | LatestReading | null = current?.latest ?? null,
): ReadingState => {
  if (!current || getReadingKey(current.latest) !== getReadingKey(latest)) {
    return { latest, previous };
  }

  return {
    latest,
    previous: current.previous,
  };
};

const formatGlucoseDelta = (
  latest: LatestReading,
  previous: ChartPoint | LatestReading | null,
  unit: GlucoseUnit,
): string => {
  if (!previous) {
    return 'n/a';
  }

  return formatGlucoseDeltaValue(latest.valueMmolL - previous.valueMmolL, unit);
};

interface DashboardGlucoseBadgeProps {
  contentAlignment?: 'horizontal' | 'vertical';
  colorMode?: GlucoseColorMode;
  enableStream?: boolean;
  fitToContainer?: boolean;
  glucoseUnit?: GlucoseUnit;
  metadataVisibility?: {
    showUnit: boolean;
    showUpdated: boolean;
    showDiff: boolean;
    showSource: boolean;
  };
  pollIntervalMs?: number;
  showDetails?: boolean;
}

const CURRENT_GLUCOSE_SOURCE_LABEL = 'Dexcom Share API';

export const DashboardGlucoseBadge = ({
  contentAlignment = 'vertical',
  colorMode = 'standard',
  enableStream = true,
  fitToContainer = false,
  glucoseUnit = 'mmol/L',
  metadataVisibility = {
    showUnit: true,
    showUpdated: true,
    showDiff: true,
    showSource: true,
  },
  pollIntervalMs = 60_000,
  showDetails = false,
}: DashboardGlucoseBadgeProps) => {
  const [readingState, setReadingState] = useState<ReadingState | null>(() => cachedReadingState);

  useEffect(() => {
    let mounted = true;
    let eventSource: EventSource | null = null;
    let pollTimer: number | null = null;

    async function fetchLatest() {
      try {
        const res = await fetch('/api/dashboard/glucose/history?limit=2');
        if (!res.ok) return;
        const json = (await res.json()) as HistoryResponse;
        if (mounted && json.latest) {
          const latest = json.latest;
          const previous = pickPreviousReading(latest, json.items);
          setReadingState((current) => {
            const next = updateReadingStateWithLatest(current, latest, previous);
            cachedReadingState = next;
            return next;
          });
        }
      } catch {
        // Silent fail
      }
    }

    function publishLatest(reading: LatestReading) {
      setReadingState((current) => {
        const next = updateReadingStateWithLatest(current, reading);
        cachedReadingState = next;
        return next;
      });
      window.dispatchEvent(
        new CustomEvent('pulse-glucose-latest', { detail: reading }),
      );
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
        setReadingState((current) => {
          const next = updateReadingStateWithLatest(current, detail);
          cachedReadingState = next;
          return next;
        });
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

  if (!readingState) return null;

  const { latest, previous } = readingState;
  const glucoseDelta = formatGlucoseDelta(latest, previous, glucoseUnit);
  const displayedGlucoseValue = formatGlucoseValue(latest.valueMmolL, glucoseUnit);
  const hasVisibleMetadata = Boolean(
    metadataVisibility.showUnit ||
    metadataVisibility.showUpdated ||
    metadataVisibility.showDiff ||
    metadataVisibility.showSource,
  );

  const indicator = (
    <GlucoseIndicator
      value={latest.valueMmolL}
      trend={latest.trend}
      displayValue={displayedGlucoseValue}
      timestamp={latest.timestamp}
      size="lg"
      unit={glucoseUnit}
      showAge={false}
      showUnit={!showDetails}
      fitToContainer={fitToContainer}
      fitPlacement="center"
      colorMode={colorMode}
    />
  );

  if (!showDetails || !hasVisibleMetadata) {
    return indicator;
  }

  const layoutClassName = contentAlignment === 'horizontal'
    ? 'items-center justify-center gap-8'
    : 'content-center justify-items-center';
  const metadataClassName = contentAlignment === 'horizontal'
    ? 'content-center justify-self-end'
    : 'content-start justify-self-center';
  const indicatorContainerClassName = 'place-items-center';
  const rootStyle: CSSProperties = {
    containerType: 'size',
    ...(contentAlignment === 'horizontal'
      ? {
          gridTemplateColumns:
            'minmax(10rem, max-content) minmax(10rem, min(72cqh, 40rem))',
        }
      : {}),
  };
  const indicatorContainerStyle: CSSProperties = {
    containerType: 'size',
    ...(contentAlignment === 'horizontal'
      ? {
          height: 'min(72cqh, 40rem)',
          width: 'min(72cqh, 40rem)',
        }
      : {}),
    ...(contentAlignment === 'vertical'
      ? {
          height: 'min(72cqw, max(10rem, calc(100cqh - 7rem)), 40rem)',
          width: 'min(100%, 40rem)',
        }
      : {}),
  };

  return (
    <div
      className={twMerge('grid h-full min-h-0 w-full min-w-0 gap-3 overflow-hidden', layoutClassName)}
      style={rootStyle}
    >
      <dl
        className={twMerge('z-10 grid min-w-0 gap-2 overflow-hidden text-left', metadataClassName)}
      >
        {metadataVisibility.showUnit ? (
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-4">
            <dt className="ui_micro_label text-text-soft">Unit</dt>
            <dd className="ui_caption m-0 min-w-0 break-words text-text-dim">{glucoseUnit}</dd>
          </div>
        ) : null}
        {metadataVisibility.showUpdated ? (
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-4">
            <dt className="ui_micro_label text-text-soft">Updated</dt>
            <dd className="m-0">
              <DataFreshnessLight timestamp={latest.timestamp} />
            </dd>
          </div>
        ) : null}
        {metadataVisibility.showDiff ? (
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-4">
            <dt className="ui_micro_label text-text-soft">Diff</dt>
            <dd className="ui_caption m-0 min-w-0 break-words text-text-dim">{glucoseDelta}</dd>
          </div>
        ) : null}
        {metadataVisibility.showSource ? (
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-4">
            <dt className="ui_micro_label text-text-soft">Source</dt>
            <dd className="ui_caption m-0 min-w-0 break-words text-text-dim">{CURRENT_GLUCOSE_SOURCE_LABEL}</dd>
          </div>
        ) : null}
      </dl>
      <div
        className={twMerge('grid h-full min-h-0 w-full min-w-0 overflow-hidden', indicatorContainerClassName)}
        style={indicatorContainerStyle}
      >
        {indicator}
      </div>
    </div>
  );
};
