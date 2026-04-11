import type { TimelineNote } from './types';

export interface TimelineNoteDraft {
  text: string;
  timezone: string;
  allDay: boolean;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  authorType: 'user' | 'assistant';
  source: string;
}

export interface TimelineNoteValidationResult {
  payload: {
    text: string;
    timezone: string;
    allDay: boolean;
    startDate: string;
    endDate: string;
    startTime?: string | null;
    endTime?: string | null;
    authorType?: 'user' | 'assistant';
    source?: string | null;
  } | null;
  preview: TimelineNote | null;
  error: string | null;
}

export function isMultiDayTimelineNoteDraft(
  draft: Pick<TimelineNoteDraft, 'startDate' | 'endDate'>
): boolean {
  return draft.startDate !== draft.endDate;
}

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function getLocalPartsFromIso(iso: string, timeZone: string): LocalDateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = formatter.formatToParts(new Date(iso));
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
    millisecond: 0
  };
}

function getTimeZoneOffsetMs(utcTimestamp: number, timeZone: string): number {
  const instant = new Date(utcTimestamp);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = formatter.formatToParts(instant);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');

  const zonedUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second')
  );

  const plainUtc = Date.UTC(
    instant.getUTCFullYear(),
    instant.getUTCMonth(),
    instant.getUTCDate(),
    instant.getUTCHours(),
    instant.getUTCMinutes(),
    instant.getUTCSeconds()
  );

  return zonedUtc - plainUtc;
}

function toUtcIso(parts: LocalDateTimeParts, timeZone: string): string {
  let utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond
  );

  const initialOffset = getTimeZoneOffsetMs(utcGuess, timeZone);
  utcGuess -= initialOffset;

  const correctedOffset = getTimeZoneOffsetMs(utcGuess, timeZone);
  if (correctedOffset !== initialOffset) {
    utcGuess = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond
    );
    utcGuess -= correctedOffset;
  }

  return new Date(utcGuess).toISOString();
}

function buildUtcFromDraft(date: string, time: string, timeZone: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);

  return toUtcIso(
    {
      year,
      month,
      day,
      hour,
      minute,
      second: 0,
      millisecond: 0
    },
    timeZone
  );
}

export function snapTimelineNoteBoundary(
  iso: string,
  timeZone: string,
  allDay: boolean,
  edge: 'start' | 'end'
): string {
  const parts = getLocalPartsFromIso(iso, timeZone);

  if (allDay) {
    return toUtcIso(
      {
        ...parts,
        hour: edge === 'start' ? 0 : 23,
        minute: edge === 'start' ? 0 : 59,
        second: edge === 'start' ? 0 : 59,
        millisecond: edge === 'start' ? 0 : 999
      },
      timeZone
    );
  }

  const naive = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0));
  const totalMinutes = naive.getUTCHours() * 60 + naive.getUTCMinutes();
  const snappedMinutes = Math.round(totalMinutes / 30) * 30;
  naive.setUTCHours(0, 0, 0, 0);
  naive.setUTCMinutes(snappedMinutes);

  return toUtcIso(
    {
      year: naive.getUTCFullYear(),
      month: naive.getUTCMonth() + 1,
      day: naive.getUTCDate(),
      hour: naive.getUTCHours(),
      minute: naive.getUTCMinutes(),
      second: 0,
      millisecond: 0
    },
    timeZone
  );
}

export function getLocalDateString(iso: string, timeZone: string): string {
  const parts = getLocalPartsFromIso(iso, timeZone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function getLocalTimeString(iso: string, timeZone: string): string {
  const parts = getLocalPartsFromIso(iso, timeZone);
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function createTimelineNoteDraft(
  timeZone: string,
  hoveredAt: string | null
): TimelineNoteDraft {
  const baseIso = hoveredAt ?? new Date().toISOString();

  return {
    text: '',
    timezone: timeZone,
    allDay: true,
    startDate: getLocalDateString(baseIso, timeZone),
    endDate: getLocalDateString(baseIso, timeZone),
    startTime: hoveredAt ? getLocalTimeString(baseIso, timeZone) : '',
    endTime: '',
    authorType: 'user',
    source: 'dashboard'
  };
}

export function draftFromTimelineNote(note: TimelineNote): TimelineNoteDraft {
  const startDate = getLocalDateString(note.startAt, note.timezone);
  const endDate = getLocalDateString(note.endAt, note.timezone);
  const allDay = note.allDay || startDate !== endDate;

  return {
    text: note.text,
    timezone: note.timezone,
    allDay,
    startDate,
    endDate,
    startTime: allDay ? '' : getLocalTimeString(note.startAt, note.timezone),
    endTime: allDay ? '' : getLocalTimeString(note.endAt, note.timezone),
    authorType: note.authorType,
    source: note.source ?? ''
  };
}

export function validateTimelineNoteDraft(
  draft: TimelineNoteDraft,
  existing: TimelineNote | null
): TimelineNoteValidationResult {
  const isMultiDay = isMultiDayTimelineNoteDraft(draft);
  const effectiveAllDay = draft.allDay || isMultiDay;
  const text = draft.text.trim();
  if (text.replace(/\s/g, '').length < 3) {
    return { payload: null, preview: null, error: 'Notes must contain at least 3 non whitespace characters.' };
  }

  if (!draft.timezone) {
    return { payload: null, preview: null, error: 'Timezone is required.' };
  }

  if (!effectiveAllDay && (!draft.startTime || !draft.endTime)) {
    return { payload: null, preview: null, error: 'Timed notes require both a start time and an end time.' };
  }

  const startAt = effectiveAllDay
    ? buildUtcFromDraft(draft.startDate, '00:00', draft.timezone)
    : buildUtcFromDraft(draft.startDate, draft.startTime, draft.timezone);
  const endAt = effectiveAllDay
    ? toUtcIso(
        {
          year: Number(draft.endDate.slice(0, 4)),
          month: Number(draft.endDate.slice(5, 7)),
          day: Number(draft.endDate.slice(8, 10)),
          hour: 23,
          minute: 59,
          second: 59,
          millisecond: 999
        },
        draft.timezone
      )
    : buildUtcFromDraft(draft.endDate, draft.endTime, draft.timezone);

  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    return { payload: null, preview: null, error: 'End time must be after start time.' };
  }

  const payload = {
    text,
    timezone: draft.timezone,
    allDay: effectiveAllDay,
    startDate: draft.startDate,
    endDate: draft.endDate,
    startTime: effectiveAllDay ? null : draft.startTime,
    endTime: effectiveAllDay ? null : draft.endTime,
    authorType: draft.authorType,
    source: draft.source.trim() || null
  };

  if (!effectiveAllDay && new Date(endAt).getTime() - new Date(startAt).getTime() < 30 * 60 * 1000) {
    return { payload: null, preview: null, error: 'Timed notes must be at least 30 minutes long.' };
  }

  const previewCreatedAt = existing?.createdAt ?? startAt;
  const previewUpdatedAt = existing?.updatedAt ?? previewCreatedAt;
  const previewCreatedBy = existing?.createdBy ?? 'admin@pulseglucose.local';
  const previewUpdatedBy = existing?.updatedBy ?? previewCreatedBy;

  return {
    payload,
    preview: {
      id: existing?.id ?? 'draft-note',
      text,
      startAt,
      endAt,
      timezone: draft.timezone,
      allDay: effectiveAllDay,
      authorType: draft.authorType,
      source: draft.source.trim() || 'dashboard',
      createdAt: previewCreatedAt,
      updatedAt: previewUpdatedAt,
      createdBy: previewCreatedBy,
      updatedBy: previewUpdatedBy
    },
    error: null
  };
}
