import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import { PulseApiClientError, fetchConsumerProfile, updateConsumerProfile } from '@/lib/pulse-api/client';
import type { ConsumerProfileUpdatePayload } from '@/lib/pulse-api/types';

function readTimezone(request: NextRequest): string | undefined {
  return request.headers.get('x-user-timezone') || undefined;
}

export async function GET(request: NextRequest) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  try {
    const response = await fetchConsumerProfile(readTimezone(request));
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const status = error instanceof PulseApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to load settings' } },
      { status }
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const payload = (await request.json()) as ConsumerProfileUpdatePayload;

  try {
    const response = await updateConsumerProfile(payload, readTimezone(request));
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const status = error instanceof PulseApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to update settings' } },
      { status }
    );
  }
}
