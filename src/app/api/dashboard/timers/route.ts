import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import {
  createSharedTimerMutation,
  fetchSharedTimers,
  VenoApiClientError
} from '@/lib/veno-api/client';
import type { CreateSharedTimerPayload } from '@/lib/veno-api/types';
import { applyRateLimit, createRateLimitResponse, getClientIp } from '@/lib/security/rate-limit';

export async function GET(request: Request) {
  const rateLimit = applyRateLimit({
    key: `timers:${getClientIp(request)}`,
    limit: 60,
    windowMs: 60 * 1000
  });
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit, 'Too many timer requests. Try again soon.');
  }

  try {
    const response = await fetchSharedTimers();
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const status = error instanceof VenoApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to load timers' } },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const payload = (await request.json()) as CreateSharedTimerPayload;

  try {
    const response = await createSharedTimerMutation(payload);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const status = error instanceof VenoApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to create timer' } },
      { status }
    );
  }
}
