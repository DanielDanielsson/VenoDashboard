import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import {
  deleteTimelineNote,
  updateTimelineNote
} from '@/lib/veno-api/timeline-notes';
import type { TimelineNoteWritePayload } from '@/lib/veno-api/types';

interface RouteParams {
  params: Promise<{
    noteId: string;
  }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const payload = (await request.json()) as TimelineNoteWritePayload;
  const { noteId } = await params;

  try {
    const note = await updateTimelineNote(noteId, payload, session.user.email);
    return NextResponse.json({ note }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to update timeline note' } },
      { status: 502 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const { noteId } = await params;

  try {
    const result = await deleteTimelineNote(noteId, session.user.email);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to delete timeline note' } },
      { status: 502 }
    );
  }
}
