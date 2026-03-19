import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import { PulseApiClientError, createApiKey } from '@/lib/pulse-api/client';

export async function POST(request: NextRequest) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const payload = (await request.json()) as { name?: string };

  try {
    const response = await createApiKey(payload.name || '');
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const status = error instanceof PulseApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to create API key' } },
      { status }
    );
  }
}
