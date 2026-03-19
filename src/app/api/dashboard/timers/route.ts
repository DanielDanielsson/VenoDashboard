import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import {
  createSharedTimerMutation,
  fetchSharedTimers,
  PulseApiClientError
} from '@/lib/pulse-api/client';
import type { CreateSharedTimerPayload } from '@/lib/pulse-api/types';

export async function GET() {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  try {
    const response = await fetchSharedTimers();
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const status = error instanceof PulseApiClientError ? error.status : 502;
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
    const status = error instanceof PulseApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to create timer' } },
      { status }
    );
  }
}
