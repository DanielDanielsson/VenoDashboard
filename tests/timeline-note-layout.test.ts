import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  assignTimelineNoteLanes,
  getTimelineNoteBandHeight,
  getTimelineNotesAtTimestamp
} from '@/lib/glucose/timeline-note-layout';
import {
  createTimelineNoteDraft,
  draftFromTimelineNote,
  isMultiDayTimelineNoteDraft,
  validateTimelineNoteDraft
} from '@/lib/glucose/timeline-note-form';

const notes = [
  {
    id: 'note-1',
    text: 'A',
    startAt: '2026-04-09T08:00:00.000Z',
    endAt: '2026-04-09T10:00:00.000Z',
    timezone: 'Europe/Stockholm',
    allDay: false,
    authorType: 'user' as const,
    source: 'dashboard',
    createdAt: '2026-04-09T07:00:00.000Z',
    updatedAt: '2026-04-09T07:00:00.000Z',
    createdBy: 'admin@pulseglucose.local',
    updatedBy: 'admin@pulseglucose.local'
  },
  {
    id: 'note-2',
    text: 'B',
    startAt: '2026-04-09T09:00:00.000Z',
    endAt: '2026-04-09T11:00:00.000Z',
    timezone: 'Europe/Stockholm',
    allDay: false,
    authorType: 'user' as const,
    source: 'dashboard',
    createdAt: '2026-04-09T07:05:00.000Z',
    updatedAt: '2026-04-09T07:05:00.000Z',
    createdBy: 'admin@pulseglucose.local',
    updatedBy: 'admin@pulseglucose.local'
  },
  {
    id: 'note-3',
    text: 'C',
    startAt: '2026-04-09T10:00:00.000Z',
    endAt: '2026-04-09T11:00:00.000Z',
    timezone: 'Europe/Stockholm',
    allDay: false,
    authorType: 'user' as const,
    source: 'dashboard',
    createdAt: '2026-04-09T07:10:00.000Z',
    updatedAt: '2026-04-09T07:10:00.000Z',
    createdBy: 'admin@pulseglucose.local',
    updatedBy: 'admin@pulseglucose.local'
  }
];

describe('timeline note helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('assigns stable lanes and lets abutting notes reuse a lane', () => {
    const assigned = assignTimelineNoteLanes(notes);

    expect(assigned.find((note) => note.id === 'note-1')?.lane).toBe(0);
    expect(assigned.find((note) => note.id === 'note-2')?.lane).toBe(1);
    expect(assigned.find((note) => note.id === 'note-3')?.lane).toBe(0);
    expect(getTimelineNoteBandHeight(notes)).toBeGreaterThan(24);
  });

  test('returns overlapping notes in visual lane order', () => {
    const assigned = assignTimelineNoteLanes(notes);
    const hovered = getTimelineNotesAtTimestamp(assigned, new Date('2026-04-09T09:30:00.000Z').getTime());

    expect(hovered.map((note) => note.id)).toEqual(['note-1', 'note-2']);
  });

  test('builds a default draft using the hovered time in the selected timezone', () => {
    const draft = createTimelineNoteDraft('Europe/Stockholm', '2026-04-09T08:30:00.000Z');

    expect(draft.startDate).toBe('2026-04-09');
    expect(draft.startTime).toBe('10:30');
    expect(draft.allDay).toBe(true);
  });

  test('round trips an existing note through the form draft and preview validation', () => {
    const draft = draftFromTimelineNote({
      ...notes[0],
      text: 'Delayed breakfast bolus'
    });
    draft.text = 'Delayed breakfast bolus';

    const result = validateTimelineNoteDraft(draft, notes[0]);

    expect(result.error).toBeNull();
    expect(result.preview?.text).toBe('Delayed breakfast bolus');
    expect(result.payload?.startDate).toBe(draft.startDate);
  });

  test('rejects invalid draft timing', () => {
    const draft = createTimelineNoteDraft('Europe/Stockholm', '2026-04-09T08:30:00.000Z');
    draft.text = 'Late dinner';
    draft.allDay = false;
    draft.startTime = '10:00';
    draft.endTime = '09:30';

    const result = validateTimelineNoteDraft(draft, null);

    expect(result.error).toBe('End time must be after start time.');
    expect(result.payload).toBeNull();
  });

  test('forces multi day drafts to all day mode', () => {
    const draft = createTimelineNoteDraft('Europe/Stockholm', '2026-04-09T08:30:00.000Z');
    draft.text = 'Conference week effect';
    draft.allDay = false;
    draft.startTime = '10:00';
    draft.endTime = '12:00';
    draft.endDate = '2026-04-10';

    expect(isMultiDayTimelineNoteDraft(draft)).toBe(true);

    const result = validateTimelineNoteDraft(draft, null);

    expect(result.error).toBeNull();
    expect(result.payload?.allDay).toBe(true);
    expect(result.payload?.startTime).toBeNull();
    expect(result.payload?.endTime).toBeNull();
    expect(result.preview?.allDay).toBe(true);
  });

  test('keeps preview metadata stable for the same draft input', () => {
    vi.useFakeTimers();

    const draft = createTimelineNoteDraft('Europe/Stockholm', '2026-04-09T08:30:00.000Z');
    draft.text = 'Longer glucose explanation';

    vi.setSystemTime(new Date('2026-04-09T08:00:00.000Z'));
    const first = validateTimelineNoteDraft(draft, null);

    vi.setSystemTime(new Date('2026-04-09T08:05:00.000Z'));
    const second = validateTimelineNoteDraft(draft, null);

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(second.preview?.createdAt).toBe(first.preview?.createdAt);
    expect(second.preview?.updatedAt).toBe(first.preview?.updatedAt);
  });
});
