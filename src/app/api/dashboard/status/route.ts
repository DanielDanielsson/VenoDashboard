import { NextResponse } from 'next/server';
import { VenoApiClientError, fetchApiStatus } from '@/lib/veno-api/client';
import { applyRateLimit, createRateLimitResponse, getClientIp } from '@/lib/security/rate-limit';

export async function GET(request: Request) {
  const rateLimit = applyRateLimit({
    key: `status:${getClientIp(request)}`,
    limit: 60,
    windowMs: 60 * 1000
  });
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, 'Too many status requests. Try again soon.');
  }

  try {
    const report = await fetchApiStatus();
    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    const status = error instanceof VenoApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to load status' } },
      { status }
    );
  }
}
