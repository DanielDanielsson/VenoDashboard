import type { TimelineNote } from './types';

export const NOTE_ROW_HEIGHT = 24;
export const NOTE_ROW_GAP = 4;
export const NOTE_BAND_GAP = 20;
export const NOTE_BAND_PADDING_Y = 6;
export const TIMED_NOTE_STEP_MINUTES = 30;

export interface LaneAssignedTimelineNote extends TimelineNote {
  lane: number;
}

function toMs(value: string): number {
  return new Date(value).getTime();
}

function sortNotesForLanes(notes: TimelineNote[]): TimelineNote[] {
  return [...notes].sort((left, right) => {
    const startDiff = toMs(left.startAt) - toMs(right.startAt);
    if (startDiff !== 0) {
      return startDiff;
    }

    const leftDuration = toMs(left.endAt) - toMs(left.startAt);
    const rightDuration = toMs(right.endAt) - toMs(right.startAt);
    if (rightDuration !== leftDuration) {
      return rightDuration - leftDuration;
    }

    const createdDiff = toMs(left.createdAt) - toMs(right.createdAt);
    if (createdDiff !== 0) {
      return createdDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

export function assignTimelineNoteLanes(notes: TimelineNote[]): LaneAssignedTimelineNote[] {
  const laneEndTimes: number[] = [];

  return sortNotesForLanes(notes).map((note) => {
    const startMs = toMs(note.startAt);
    let lane = laneEndTimes.findIndex((endMs) => endMs <= startMs);

    if (lane < 0) {
      lane = laneEndTimes.length;
      laneEndTimes.push(toMs(note.endAt));
    } else {
      laneEndTimes[lane] = toMs(note.endAt);
    }

    return {
      ...note,
      lane
    };
  });
}

export function getTimelineNoteLaneCount(notes: TimelineNote[]): number {
  return assignTimelineNoteLanes(notes).reduce((maxLane, note) => Math.max(maxLane, note.lane + 1), 0);
}

export function getTimelineNoteBandHeight(notes: TimelineNote[]): number {
  const laneCount = getTimelineNoteLaneCount(notes);
  const visibleRows = laneCount + 1;
  return NOTE_BAND_PADDING_Y * 2 + visibleRows * NOTE_ROW_HEIGHT + Math.max(0, visibleRows - 1) * NOTE_ROW_GAP;
}

export function getTimelineNotesAtTimestamp(
  notes: LaneAssignedTimelineNote[],
  timestampMs: number
): LaneAssignedTimelineNote[] {
  return notes
    .filter((note) => {
      const startMs = toMs(note.startAt);
      const endMs = toMs(note.endAt);
      return timestampMs >= startMs && timestampMs < endMs;
    })
    .sort((left, right) => left.lane - right.lane || toMs(right.updatedAt) - toMs(left.updatedAt));
}
