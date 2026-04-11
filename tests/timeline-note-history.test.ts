import { describe, expect, test } from 'vitest';
import {
  buildDisplayedTimelineNotes,
  removeTimelineNoteFromHistoryResponse,
  upsertTimelineNoteInHistoryResponse
} from '@/lib/glucose/timeline-note-history';
import type { GlucoseApiResponse, TimelineNote } from '@/lib/glucose/types';

function createResponse(): GlucoseApiResponse {
  return {
    items: [],
    basalItems: [],
    eventItems: [],
    stepItems: [],
    noteItems: [
      {
        id: 'note-1',
        text: 'First note',
        startAt: '2026-03-29T06:00:00.000Z',
        endAt: '2026-03-29T07:00:00.000Z',
        timezone: 'UTC',
        allDay: false,
        authorType: 'user',
        source: null,
        createdAt: '2026-03-29T06:00:00.000Z',
        updatedAt: '2026-03-29T06:00:00.000Z',
        createdBy: 'owner@example.com',
        updatedBy: 'owner@example.com'
      }
    ],
    latest: null,
    meta: {
      from: '2026-03-29T00:00:00.000Z',
      to: '2026-03-30T00:00:00.000Z',
      officialCount: 0,
      shareCount: 0,
      mergedCount: 0,
      tandemBasalCount: 0,
      tandemEventCount: 0,
      healthStepCount: 0,
      timelineRevision: '2026-03-29T06:00:00.000Z'
    }
  };
}

function createUpdatedNote(): TimelineNote {
  return {
    id: 'note-1',
    text: 'Updated note',
    startAt: '2026-03-29T06:30:00.000Z',
    endAt: '2026-03-29T07:30:00.000Z',
    timezone: 'UTC',
    allDay: false,
    authorType: 'user',
    source: null,
    createdAt: '2026-03-29T06:00:00.000Z',
    updatedAt: '2026-03-29T08:00:00.000Z',
    createdBy: 'owner@example.com',
    updatedBy: 'owner@example.com'
  };
}

describe('timeline note history cache helpers', () => {
  test('upserts a note into the visible response immediately', () => {
    const response = createResponse();
    const updated = upsertTimelineNoteInHistoryResponse(response, createUpdatedNote());

    expect(updated.noteItems).toHaveLength(1);
    expect(updated.noteItems?.[0]?.text).toBe('Updated note');
    expect(updated.meta.timelineRevision).toBe('2026-03-29T08:00:00.000Z');
  });

  test('removes a note from the visible response immediately', () => {
    const response = createResponse();
    const updated = removeTimelineNoteFromHistoryResponse(
      response,
      'note-1',
      '2026-03-29T09:00:00.000Z'
    );

    expect(updated.noteItems).toEqual([]);
    expect(updated.meta.timelineRevision).toBe('2026-03-29T09:00:00.000Z');
  });

  test('filters deleted notes before revalidation completes', () => {
    const response = createResponse();

    const displayed = buildDisplayedTimelineNotes(response.noteItems, {
      deletedIds: ['note-1']
    });

    expect(displayed).toEqual([]);
  });

  test('replaces the visible note with the active preview', () => {
    const response = createResponse();
    const preview = {
      ...response.noteItems?.[0],
      text: 'Preview text',
      endAt: '2026-03-29T08:00:00.000Z'
    } as TimelineNote;

    const displayed = buildDisplayedTimelineNotes(response.noteItems, {
      previewNote: preview
    });

    expect(displayed).toHaveLength(1);
    expect(displayed[0]?.text).toBe('Preview text');
    expect(displayed[0]?.endAt).toBe('2026-03-29T08:00:00.000Z');
  });
});
