import { NextResponse } from 'next/server';
import { fetchAdminHealthSteps, fetchApiStatus, listApiKeys, PulseApiClientError } from '@/lib/pulse-api/client';
import { applyRateLimit, createRateLimitResponse, getClientIp } from '@/lib/security/rate-limit';
import {
  buildConnectionMapSnapshot,
  getLatestHealthStepBucketEnd,
  getLatestTandemActivityAt,
} from '@/lib/dashboard/connection-map';
import { fetchTandemBasalHistory, fetchTandemEventHistory } from '@/lib/pulse-api/glucose';

export async function GET(request: Request) {
  const rateLimit = applyRateLimit({
    key: `connections:${getClientIp(request)}`,
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, 'Too many connection requests. Try again soon.');
  }

  const now = new Date();
  const healthStepsFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentTandemFrom = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  try {
    const [report, healthSteps, tandemBasal, tandemEvents, apiKeys] = await Promise.all([
      fetchApiStatus(),
      fetchAdminHealthSteps(healthStepsFrom, nowIso).catch(() => ({ items: [] })),
      fetchTandemBasalHistory(recentTandemFrom, nowIso, 5000).catch(() => ({ items: [], meta: { from: recentTandemFrom, to: nowIso, limit: 5000, returned: 0 } })),
      fetchTandemEventHistory(recentTandemFrom, nowIso, 5000).catch(() => ({ items: [], meta: { from: recentTandemFrom, to: nowIso, limit: 5000, returned: 0 } })),
      listApiKeys().catch(() => ({ items: [] })),
    ]);

    const snapshot = buildConnectionMapSnapshot({
      report,
      latestHealthStepBucketEnd: getLatestHealthStepBucketEnd(healthSteps.items),
      latestTandemActivityAt: getLatestTandemActivityAt({
        basalTimestamps: tandemBasal.items.map((item) => item.timestamp),
        eventTimestamps: tandemEvents.items.map((item) => item.timestamp),
      }),
      apiKeys: apiKeys.items,
      now,
    });

    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    const status = error instanceof PulseApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to load connections' } },
      { status },
    );
  }
}
