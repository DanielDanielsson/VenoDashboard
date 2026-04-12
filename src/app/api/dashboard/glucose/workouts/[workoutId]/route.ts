import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import {
  deleteManualWorkout,
  updateManualWorkout
} from '@/lib/pulse-api/workouts';
import type { WorkoutWritePayload } from '@/lib/pulse-api/types';

interface RouteParams {
  params: Promise<{
    workoutId: string;
  }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const payload = (await request.json()) as WorkoutWritePayload;
  const { workoutId } = await params;

  try {
    const workout = await updateManualWorkout(workoutId, payload, session.user.email);
    return NextResponse.json({ workout }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to update workout' } },
      { status: 502 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const { workoutId } = await params;

  try {
    const result = await deleteManualWorkout(workoutId, session.user.email);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to delete workout' } },
      { status: 502 }
    );
  }
}
