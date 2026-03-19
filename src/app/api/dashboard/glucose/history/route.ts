import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import {
  fetchLatestDashboardReading,
  fetchMergedGlucoseWindow,
  parseLimit,
  resolveHistoryWindow
} from '@/lib/glucose/dashboard-data';

export async function GET(request: NextRequest) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const requestedLimit = parseLimit(params.get('limit'));
  const now = new Date();
  const { from, to, hasExplicitRange } = resolveHistoryWindow({
    range: params.get('range'),
    from: params.get('from'),
    to: params.get('to'),
    now
  });

  try {
    const latest = await fetchLatestDashboardReading();

    if (!hasExplicitRange && requestedLimit === 1) {
      return NextResponse.json({
        items: latest
          ? [
              {
                timestamp: latest.timestamp,
                valueMmolL: latest.valueMmolL,
                valueMgDl: latest.valueMgDl,
                trend: latest.trend,
                source: latest.source
        }
            ]
          : [],
        basalItems: [],
        eventItems: [],
        latest,
        meta: {
          from,
          to,
          officialCount: latest?.source === 'official' ? 1 : 0,
          shareCount: latest?.source === 'share' ? 1 : 0,
          mergedCount: latest ? 1 : 0,
          tandemBasalCount: 0,
          tandemEventCount: 0
        }
      });
    }

    const { officialItems, shareItems, tandemBasalItems, tandemEventItems, merged } = await fetchMergedGlucoseWindow(from, to, now);
    const items = requestedLimit ? merged.slice(-requestedLimit) : merged;

    return NextResponse.json({
      items,
      basalItems: tandemBasalItems,
      eventItems: tandemEventItems,
      latest,
      meta: {
        from,
        to,
        officialCount: officialItems.length,
        shareCount: shareItems.length,
        mergedCount: items.length,
        tandemBasalCount: tandemBasalItems.length,
        tandemEventCount: tandemEventItems.length
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to load glucose data' } },
      { status: 502 }
    );
  }
}
