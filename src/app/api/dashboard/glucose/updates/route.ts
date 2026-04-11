import { NextRequest, NextResponse } from 'next/server';
import { dashboardGlucoseWorkspace } from '@/lib/glucose/dashboard-workspace';
import { applyRateLimit, createRateLimitResponse, getClientIp } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rateLimit = applyRateLimit({
    key: `glucose-updates:${getClientIp(request)}`,
    limit: 60,
    windowMs: 60 * 1000
  });
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, 'Too many glucose update requests. Try again soon.');
  }

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
    const response = await dashboardGlucoseWorkspace.getUpdatesSince(since, new Date());
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to load glucose updates' } },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}
