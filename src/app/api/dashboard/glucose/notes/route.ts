import { NextRequest, NextResponse } from 'next/server';
import { getOwnerSession } from '@/lib/auth';
import { createTimelineNote } from '@/lib/pulse-api/timeline-notes';
import type { TimelineNoteWritePayload } from '@/lib/pulse-api/types';

export async function POST(request: NextRequest) {
  const session = await getOwnerSession();
  if (!session) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const payload = (await request.json()) as TimelineNoteWritePayload;

  try {
    const note = await createTimelineNote(payload, session.user.email);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Failed to create timeline note' } },
      { status: 502 }
    );
  }
}
