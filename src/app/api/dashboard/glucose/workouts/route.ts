import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import { createManualWorkout } from '@/lib/veno-api/workouts';
import type { WorkoutWritePayload } from '@/lib/veno-api/types';

export async function POST(request: NextRequest) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const payload = (await request.json()) as WorkoutWritePayload;

  try {
    const workout = await createManualWorkout(payload, session.user.email);
    return NextResponse.json({ workout }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to create workout' } },
      { status: 502 }
    );
  }
}
