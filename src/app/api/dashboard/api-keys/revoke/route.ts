import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import { isSystemApiKeyName } from '@/lib/pulse-api/key-visibility';
import { PulseApiClientError, listApiKeys, revokeApiKey } from '@/lib/pulse-api/client';

export async function POST(request: NextRequest) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const payload = (await request.json()) as { id?: string };

  try {
    const keyId = (payload.id || '').trim();
    if (!keyId) {
      return NextResponse.json({ error: { message: 'Missing API key id' } }, { status: 400 });
    }

    const listed = await listApiKeys();
    const key = listed.items.find((item) => item.id === keyId);
    if (key && isSystemApiKeyName(key.name)) {
      return NextResponse.json({ error: { message: 'This API key is protected' } }, { status: 403 });
    }

    await revokeApiKey(keyId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const status = error instanceof PulseApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to delete API key' } },
      { status }
    );
  }
}
