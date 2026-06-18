import { describe, expect, test } from 'vitest';
import {
  TIME_RANGE_CLIPBOARD_FORMAT,
  TIME_RANGE_CLIPBOARD_VERSION,
  parseTimeRangeClipboardValue,
  serializeTimeRangeClipboardValue,
} from '@/lib/glucose/time-range-clipboard';

describe('time range clipboard values', () => {
  test('serializes a versioned dashboard time range payload', () => {
    const serialized = serializeTimeRangeClipboardValue({
      from: '2026-03-07T10:30:00.000Z',
      to: '2026-03-07T11:00:00.000Z',
    });

    expect(JSON.parse(serialized)).toEqual({
      format: TIME_RANGE_CLIPBOARD_FORMAT,
      version: TIME_RANGE_CLIPBOARD_VERSION,
      range: {
        from: '2026-03-07T10:30:00.000Z',
        to: '2026-03-07T11:00:00.000Z',
      },
    });
  });

  test('parses versioned and legacy raw time range values', () => {
    expect(parseTimeRangeClipboardValue(serializeTimeRangeClipboardValue({
      from: '2026-03-07T10:30:00.000Z',
      to: '2026-03-07T11:00:00.000Z',
    }))).toEqual({
      from: '2026-03-07T10:30:00.000Z',
      to: '2026-03-07T11:00:00.000Z',
    });

    expect(parseTimeRangeClipboardValue(JSON.stringify({
      from: 'now-3h',
      to: 'now',
    }))).toEqual({
      from: 'now-3h',
      to: 'now',
    });
  });

  test('rejects unknown clipboard values', () => {
    expect(parseTimeRangeClipboardValue('plain text')).toBeNull();
    expect(parseTimeRangeClipboardValue(JSON.stringify({
      format: TIME_RANGE_CLIPBOARD_FORMAT,
      version: 2,
      range: {
        from: '2026-03-07T10:30:00.000Z',
        to: '2026-03-07T11:00:00.000Z',
      },
    }))).toBeNull();
  });
});
