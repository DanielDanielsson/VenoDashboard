import { NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import { PulseApiClientError, listApiKeys } from '@/lib/pulse-api/client';
import { isSystemApiKeyName } from '@/lib/pulse-api/key-visibility';

export async function GET() {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  try {
    const response = await listApiKeys();
    return NextResponse.json(
      { items: response.items.filter((item) => !isSystemApiKeyName(item.name)) },
      { status: 200 }
    );
  } catch (error) {
    const status = error instanceof PulseApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to load API keys' } },
      { status }
    );
  }
}
