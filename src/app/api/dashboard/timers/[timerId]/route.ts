import { NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import { PulseApiClientError, removeSharedTimerMutation } from '@/lib/pulse-api/client';

interface RouteContext {
  params: Promise<{
    timerId: string;
  }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const { timerId } = await context.params;

  try {
    const response = await removeSharedTimerMutation(timerId);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const status = error instanceof PulseApiClientError ? error.status : 502;
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to remove timer' } },
      { status }
    );
  }
}
