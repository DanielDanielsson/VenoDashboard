// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

vi.mock('uplot', () => ({
  default: class UplotMock {},
}));

vi.mock('uplot/dist/uPlot.min.css', () => ({}));

import {
  UplotGlucoseChart,
  formatUplotGlucoseAxisValue,
  getLocalMidnightSplits,
  getUplotGlucoseInRangeBounds,
  getUplotGlucoseLineSegments,
  resolveUplotGlucoseChartRenderMode,
} from './UplotGlucoseChart';

describe('UplotGlucoseChart', () => {
  test('renders the zoom hint beside the chart unit label when zooming is enabled', () => {
    render(
      <UplotGlucoseChart
        data={[]}
        timeWindow={{
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        }}
        height={320}
        yMax={18}
        colorMode="standard"
        onZoomWindowChange={vi.fn()}
      />,
    );

    const chart = screen.getByRole('img', { name: 'Glucose readings chart' });
    expect(chart).toContainElement(screen.getByText('mmol/L'));
    expect(chart).toContainElement(screen.getByText('Drag to zoom'));
    expect(screen.getByText('Drag to zoom')).toHaveClass('ml-auto', 'text-right', 'text-text-soft', 'opacity-60');
  });

  test('keeps explicit render mode overrides', () => {
    expect(resolveUplotGlucoseChartRenderMode({
      dataLength: 500,
      renderMode: 'points',
      width: 300,
    })).toBe('points');

    expect(resolveUplotGlucoseChartRenderMode({
      dataLength: 12,
      renderMode: 'line',
      width: 900,
    })).toBe('line');
  });

  test('uses a line when auto mode would pack points too tightly', () => {
    expect(resolveUplotGlucoseChartRenderMode({
      dataLength: 181,
      renderMode: 'auto',
      width: 900,
    })).toBe('line');
  });

  test('uses points when auto mode has enough horizontal room', () => {
    expect(resolveUplotGlucoseChartRenderMode({
      dataLength: 120,
      renderMode: 'auto',
      width: 900,
    })).toBe('points');
  });

  test('places x axis splits only at local midnight', () => {
    const splits = getLocalMidnightSplits(
      new Date(2026, 2, 7, 10).getTime() / 1000,
      new Date(2026, 2, 10, 9).getTime() / 1000,
    );

    expect(splits.map((value) => new Date(value * 1000).getHours())).toEqual([0, 0, 0]);
    expect(splits.map((value) => new Date(value * 1000).getDate())).toEqual([8, 9, 10]);
  });

  test('formats y axis values for the selected glucose unit', () => {
    expect(formatUplotGlucoseAxisValue(6.123, 'mmol/L')).toBe('6');
    expect(formatUplotGlucoseAxisValue(20, 'mmol/L')).toBe('20');
    expect(formatUplotGlucoseAxisValue(110.4, 'mg/dL')).toBe('110');
  });

  test('uses the same in range band after unit conversion', () => {
    expect(getUplotGlucoseInRangeBounds('mmol/L')).toEqual({
      low: 4,
      high: 10,
    });
    expect(getUplotGlucoseInRangeBounds('mg/dL')).toEqual({
      low: expect.closeTo(72.0728, 4),
      high: expect.closeTo(180.182, 4),
    });
  });

  test('splits line segments at glucose color thresholds', () => {
    const segments = getUplotGlucoseLineSegments([
      { x: 0, y: 3, valueMmolL: 3 },
      { x: 9, y: 12, valueMmolL: 12 },
    ]);

    expect(segments).toHaveLength(3);
    expect(segments.map((segment) => segment.valueMmolL)).toEqual([
      expect.closeTo(3.5, 4),
      expect.closeTo(7, 4),
      expect.closeTo(11, 4),
    ]);
    expect(segments[0].to).toEqual({
      x: expect.closeTo(1, 4),
      y: expect.closeTo(4, 4),
      valueMmolL: expect.closeTo(4, 4),
    });
    expect(segments[1].to).toEqual({
      x: expect.closeTo(7, 4),
      y: expect.closeTo(10, 4),
      valueMmolL: expect.closeTo(10, 4),
    });
  });
});
