import { NextRequest, NextResponse } from 'next/server';
import { dashboardGlucoseService } from '@/lib/glucose/dashboard-service';
import { applyRateLimit, createRateLimitResponse, getClientIp } from '@/lib/security/rate-limit';

function parseLimit(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const rateLimit = applyRateLimit({
    key: `glucose-history:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000
  });
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, 'Too many glucose history requests. Try again soon.');
  }

  const params = request.nextUrl.searchParams;
  const now = new Date();

  try {
    const response = await dashboardGlucoseService.getHistory({
      range: params.get('range'),
      from: params.get('from'),
      to: params.get('to'),
      limit: parseLimit(params.get('limit')),
      now
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to load glucose data' } },
      { status: 502 }
    );
  }
}
