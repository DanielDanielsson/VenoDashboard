import type { GlucoseApiResponse, TimelineNote } from '@/lib/glucose/types';

function noteOverlapsHistoryWindow(
  note: TimelineNote,
  response: Pick<GlucoseApiResponse, 'meta'>
): boolean {
  const startMs = new Date(note.startAt).getTime();
  const endMs = new Date(note.endAt).getTime();
  const fromMs = new Date(response.meta.from).getTime();
  const toMs = new Date(response.meta.to).getTime();

  return endMs > fromMs && startMs < toMs;
}

function sortTimelineNotes(notes: TimelineNote[]): TimelineNote[] {
  return [...notes].sort((left, right) => {
    const startDiff = new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
    if (startDiff !== 0) {
      return startDiff;
    }

    const endDiff = new Date(left.endAt).getTime() - new Date(right.endAt).getTime();
    if (endDiff !== 0) {
      return endDiff;
    }

    const createdDiff = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    if (createdDiff !== 0) {
      return createdDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

export function buildDisplayedTimelineNotes(
  noteItems: readonly TimelineNote[] | undefined,
  options: {
    deletedIds?: readonly string[];
    previewNote?: TimelineNote | null;
  } = {}
): TimelineNote[] {
  const deletedIds = new Set(options.deletedIds ?? []);
  const nextNotes = (noteItems ?? []).filter((item) => !deletedIds.has(item.id));

  if (!options.previewNote || deletedIds.has(options.previewNote.id)) {
    return sortTimelineNotes(nextNotes);
  }

  const existingIndex = nextNotes.findIndex((item) => item.id === options.previewNote?.id);
  if (existingIndex >= 0) {
    nextNotes[existingIndex] = options.previewNote;
  } else {
    nextNotes.push(options.previewNote);
  }

  return sortTimelineNotes(nextNotes);
}

export function upsertTimelineNoteInHistoryResponse(
  response: GlucoseApiResponse,
  note: TimelineNote
): GlucoseApiResponse {
  const existingNotes = (response.noteItems ?? []).filter((item) => item.id !== note.id);
  const nextNotes = noteOverlapsHistoryWindow(note, response)
    ? sortTimelineNotes([...existingNotes, note])
    : existingNotes;

  return {
    ...response,
    noteItems: nextNotes,
    meta: {
      ...response.meta,
      timelineRevision: note.updatedAt
    }
  };
}

export function removeTimelineNoteFromHistoryResponse(
  response: GlucoseApiResponse,
  noteId: string,
  revision: string
): GlucoseApiResponse {
  return {
    ...response,
    noteItems: (response.noteItems ?? []).filter((item) => item.id !== noteId),
    meta: {
      ...response.meta,
      timelineRevision: revision
    }
  };
}
