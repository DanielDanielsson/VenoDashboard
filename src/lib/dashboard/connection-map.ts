import type { ApiKeySummary, VenoApiSourceStatus, VenoApiStatusReport } from '@/lib/veno-api/types';

export type ConnectionNodeState = 'live' | 'stale' | 'fault' | 'inactive';

export type ConnectionNodeIcon =
  | 'glucose'
  | 'activity'
  | 'smartphone'
  | 'desktop'
  | 'server'
  | 'lightbulb'
  | 'veno-logo';

export interface ConnectionMapNode {
  id: string;
  label: string;
  detail: string;
  icon: ConnectionNodeIcon;
  state: ConnectionNodeState;
  latestActivityAt: string | null;
  ageLabel: string | null;
}

export interface ConnectionMapEdge {
  id: string;
  from: string;
  to: string;
  state: ConnectionNodeState;
  direction: 'one-way' | 'two-way';
}

export interface ConnectionMapSnapshot {
  updatedAt: string;
  nodes: ConnectionMapNode[];
  edges: ConnectionMapEdge[];
}

function formatLag(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }

  const roundedMinutes = Math.max(0, Math.round(value));
  const days = Math.floor(roundedMinutes / (24 * 60));
  const hours = Math.floor((roundedMinutes % (24 * 60)) / 60);
  const minutes = roundedMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ago`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ago`;
  }

  return `${minutes}m ago`;
}

function getLatestIsoTimestamp(values: Array<string | null | undefined>): string | null {
  let latestMs = Number.NEGATIVE_INFINITY;
  let latestIso: string | null = null;

  for (const value of values) {
    if (!value) {
      continue;
    }

    const timestampMs = new Date(value).getTime();
    if (Number.isNaN(timestampMs)) {
      continue;
    }

    if (timestampMs > latestMs) {
      latestMs = timestampMs;
      latestIso = new Date(timestampMs).toISOString();
    }
  }

  return latestIso;
}

function getMinutesSince(nowMs: number, isoTimestamp: string | null | undefined): number | null {
  if (!isoTimestamp) {
    return null;
  }

  const timestampMs = new Date(isoTimestamp).getTime();
  if (Number.isNaN(timestampMs)) {
    return null;
  }

  return (nowMs - timestampMs) / (60 * 1000);
}

interface FreshnessThresholds {
  liveMaxMinutes: number;
  staleMaxMinutes: number;
}

function getFreshnessState(ageMinutes: number | null, thresholds: FreshnessThresholds, fallbackWhenMissing: ConnectionNodeState): ConnectionNodeState {
  if (ageMinutes == null) {
    return fallbackWhenMissing;
  }

  if (ageMinutes <= thresholds.liveMaxMinutes) {
    return 'live';
  }

  if (ageMinutes <= thresholds.staleMaxMinutes) {
    return 'stale';
  }

  return 'fault';
}

function getSourceState(source: VenoApiSourceStatus, thresholds: FreshnessThresholds = {
  liveMaxMinutes: 20,
  staleMaxMinutes: 180,
}): ConnectionNodeState {
  if (!source.connected) {
    return 'fault';
  }

  return getFreshnessState(
    source.latestReadingAgeMinutes,
    thresholds,
    source.stable ? 'live' : 'stale',
  );
}

function getStepState(ageMinutes: number | null): ConnectionNodeState {
  if (ageMinutes == null) {
    return 'inactive';
  }

  if (ageMinutes <= 30) {
    return 'live';
  }

  if (ageMinutes <= 12 * 60) {
    return 'stale';
  }

  return 'fault';
}

function findAppApiKey(apiKeys: ApiKeySummary[], candidates: string[]): ApiKeySummary | null {
  const normalizedCandidates = candidates.map((candidate) => candidate.toLowerCase());

  for (const apiKey of apiKeys) {
    const normalizedName = apiKey.name.toLowerCase();
    if (normalizedCandidates.some((candidate) => normalizedName.includes(candidate))) {
      return apiKey;
    }
  }

  return null;
}

function getAppState(ageMinutes: number | null, foundKey: boolean): ConnectionNodeState {
  if (!foundKey) {
    return 'inactive';
  }

  if (ageMinutes == null) {
    return 'fault';
  }

  if (ageMinutes <= 15) {
    return 'live';
  }

  if (ageMinutes <= 12 * 60) {
    return 'stale';
  }

  return 'inactive';
}

export interface BuildConnectionMapInput {
  report: VenoApiStatusReport;
  latestHealthStepBucketEnd: string | null;
  latestTandemActivityAt: string | null;
  apiKeys: ApiKeySummary[];
  now?: Date;
}

export function buildConnectionMapSnapshot({
  report,
  latestHealthStepBucketEnd,
  latestTandemActivityAt,
  apiKeys,
  now = new Date(),
}: BuildConnectionMapInput): ConnectionMapSnapshot {
  const nowMs = now.getTime();
  const healthStepsAgeMinutes = getMinutesSince(nowMs, latestHealthStepBucketEnd);
  const tandemAgeMinutes =
    getMinutesSince(nowMs, latestTandemActivityAt) ?? report.tandem.latestReadingAgeMinutes;

  const menuBarKey = findAppApiKey(apiKeys, ['menubar-app', 'venobar', 'menu-bar']);
  const iosKey = findAppApiKey(apiKeys, ['ios-app', 'venoios', 'iphone']);

  const menuBarAgeMinutes = getMinutesSince(nowMs, menuBarKey?.lastUsedAt);
  const iosAgeMinutes = getMinutesSince(nowMs, iosKey?.lastUsedAt);

  const nodes: ConnectionMapNode[] = [
    {
      id: 'official',
      label: 'Dexcom Official API',
      detail: '3h delay (EU)',
      icon: 'glucose',
      state: getSourceState(report.official, {
        liveMaxMinutes: 190,
        staleMaxMinutes: 200,
      }),
      latestActivityAt: report.official.latestReading?.timestamp ?? null,
      ageLabel: formatLag(report.official.latestReadingAgeMinutes),
    },
    {
      id: 'share',
      label: 'Dexcom Share API',
      detail: 'Live connection',
      icon: 'glucose',
      state: getSourceState(report.share),
      latestActivityAt: report.share.latestReading?.timestamp ?? null,
      ageLabel: formatLag(report.share.latestReadingAgeMinutes),
    },
    {
      id: 'tandem',
      label: 'Tandem Source',
      detail: 'Pump events',
      icon: 'activity',
      state: report.tandem.connected ? (tandemAgeMinutes != null && tandemAgeMinutes <= 180 ? 'live' : 'stale') : 'fault',
      latestActivityAt: latestTandemActivityAt,
      ageLabel: formatLag(tandemAgeMinutes),
    },
    {
      id: 'healthkit',
      label: 'Apple HealthKit',
      detail: 'Phone steps',
      icon: 'smartphone',
      state: getStepState(healthStepsAgeMinutes),
      latestActivityAt: latestHealthStepBucketEnd,
      ageLabel: formatLag(healthStepsAgeMinutes),
    },
    {
      id: 'veno-api',
      label: 'Veno API',
      detail: 'Unified data layer',
      icon: 'server',
      state: 'live',
      latestActivityAt: null,
      ageLabel: null,
    },
    {
      id: 'veno-dashboard',
      label: 'Veno Dashboard',
      detail: 'Live overview',
      icon: 'veno-logo',
      state: 'live',
      latestActivityAt: null,
      ageLabel: 'Rendering now',
    },
    {
      id: 'venobar',
      label: 'VenoBar',
      detail: 'Menu bar app',
      icon: 'desktop',
      state: getAppState(menuBarAgeMinutes, menuBarKey != null),
      latestActivityAt: menuBarKey?.lastUsedAt ?? null,
      ageLabel: formatLag(menuBarAgeMinutes),
    },
    {
      id: 'ios-app',
      label: 'Veno iOS',
      detail: 'Phone app',
      icon: 'smartphone',
      state: getAppState(iosAgeMinutes, iosKey != null),
      latestActivityAt: iosKey?.lastUsedAt ?? null,
      ageLabel: formatLag(iosAgeMinutes),
    },
    {
      id: 'philips-hue',
      label: 'Philips Hue',
      detail: 'Smart lights',
      icon: 'lightbulb',
      state: 'inactive',
      latestActivityAt: null,
      ageLabel: null,
    },
  ];

  const getNodeState = (id: string): ConnectionNodeState =>
    nodes.find((node) => node.id === id)?.state ?? 'inactive';

  const edges: ConnectionMapEdge[] = [
    { id: 'official-api', from: 'official', to: 'veno-api', state: getNodeState('official'), direction: 'one-way' },
    { id: 'share-api', from: 'share', to: 'veno-api', state: getNodeState('share'), direction: 'one-way' },
    { id: 'tandem-api', from: 'tandem', to: 'veno-api', state: getNodeState('tandem'), direction: 'one-way' },
    { id: 'healthkit-ios', from: 'healthkit', to: 'ios-app', state: getNodeState('healthkit'), direction: 'one-way' },
    { id: 'api-dashboard', from: 'veno-api', to: 'veno-dashboard', state: 'live', direction: 'one-way' },
    { id: 'dashboard-api', from: 'veno-dashboard', to: 'veno-api', state: 'live', direction: 'one-way' },
    { id: 'api-venobar', from: 'veno-api', to: 'venobar', state: getNodeState('venobar'), direction: 'one-way' },
    { id: 'venobar-api', from: 'venobar', to: 'veno-api', state: getNodeState('venobar'), direction: 'one-way' },
    { id: 'api-ios', from: 'veno-api', to: 'ios-app', state: getNodeState('ios-app'), direction: 'one-way' },
    { id: 'ios-api', from: 'ios-app', to: 'veno-api', state: getNodeState('ios-app'), direction: 'one-way' },
    { id: 'ios-hue', from: 'ios-app', to: 'philips-hue', state: getNodeState('philips-hue'), direction: 'one-way' },
  ];

  return {
    updatedAt: now.toISOString(),
    nodes,
    edges,
  };
}

export function getLatestHealthStepBucketEnd(values: Array<{ bucketEnd: string }>): string | null {
  return getLatestIsoTimestamp(values.map((value) => value.bucketEnd));
}

export function getLatestTandemActivityAt(values: {
  basalTimestamps: string[];
  eventTimestamps: string[];
}): string | null {
  return getLatestIsoTimestamp([...values.basalTimestamps, ...values.eventTimestamps]);
}
