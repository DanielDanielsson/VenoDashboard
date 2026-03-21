import { NextRequest, NextResponse } from 'next/server';
import { fetchLatestDashboardReading, fetchMergedGlucoseWindow } from '@/lib/glucose/dashboard-data';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const since = params.get('since');

  if (!since) {
    return NextResponse.json({ error: { message: 'Missing required since parameter' } }, { status: 400 });
  }

  const sinceMs = new Date(since).getTime();
  if (Number.isNaN(sinceMs)) {
    return NextResponse.json({ error: { message: 'Invalid since parameter' } }, { status: 400 });
  }

  try {
    const now = new Date();
    const latest = await fetchLatestDashboardReading();
    if (sinceMs >= now.getTime()) {
      return NextResponse.json({
        latest,
        meta: {
          since,
          to: now.toISOString(),
          newCount: 0
        }
      });
    }

    const from = new Date(sinceMs + 1).toISOString();
    const { merged, tandemBasalItems, tandemEventItems } = await fetchMergedGlucoseWindow(
      from,
      now.toISOString(),
      now
    );
    const newTandemBasalCount = tandemBasalItems.filter(
      (item) => new Date(item.timestamp).getTime() > sinceMs
    ).length;
    const newTandemEventCount = tandemEventItems.filter(
      (item) => new Date(item.timestamp).getTime() > sinceMs
    ).length;
    const newCount = merged.length + newTandemBasalCount + newTandemEventCount;

    return NextResponse.json({
      latest,
      meta: {
        since,
        to: now.toISOString(),
        newCount,
        newGlucoseCount: merged.length,
        newTandemBasalCount,
        newTandemEventCount
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to load glucose updates' } },
      { status: 502 }
    );
  }
}
