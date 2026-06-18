// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { GlucoseChart } from './GlucoseChart';

const ctxProxy = new Proxy(
  {},
  {
    get: (_target, key) => {
      if (key === 'measureText') {
        return () => ({ width: 24 });
      }
      if (key === 'createLinearGradient') {
        return () => ({
          addColorStop: () => undefined
        });
      }
      return () => undefined;
    },
    set: () => true,
  },
);

describe('GlucoseChart', () => {
  test('renders a per day total in the steps band', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxProxy) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 900;
      }
    });

    try {
      render(
        <GlucoseChart
          data={[
            { timestamp: '2026-03-25T00:00:00.000Z', valueMmolL: 5.8, source: 'official' },
            { timestamp: '2026-03-26T23:55:00.000Z', valueMmolL: 6.1, source: 'official' },
          ]}
          stepData={[
            {
              bucketStart: '2026-03-25T08:00:00.000Z',
              bucketEnd: '2026-03-25T08:05:00.000Z',
              stepCount: 400,
              source: 'apple_health',
            },
            {
              bucketStart: '2026-03-25T18:00:00.000Z',
              bucketEnd: '2026-03-25T18:05:00.000Z',
              stepCount: 600,
              source: 'apple_health',
            },
            {
              bucketStart: '2026-03-26T10:00:00.000Z',
              bucketEnd: '2026-03-26T10:05:00.000Z',
              stepCount: 2500,
              source: 'apple_health',
            },
          ]}
          colorMode="gradient"
        />,
      );

      expect(await screen.findByText('1,000 total')).toBeInTheDocument();
      expect(screen.getByText('2,500 total')).toBeInTheDocument();
    } finally {
      if (clientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  test('renders compact step totals for longer ranges', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxProxy) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 840;
      }
    });

    try {
      const { container } = render(
        <GlucoseChart
          data={[
            { timestamp: '2026-03-01T00:00:00.000Z', valueMmolL: 5.8, source: 'official' },
            { timestamp: '2026-03-14T23:55:00.000Z', valueMmolL: 6.1, source: 'official' },
          ]}
          stepData={Array.from({ length: 14 }, (_, index) => {
            const day = String(index + 1).padStart(2, '0');
            return {
              bucketStart: `2026-03-${day}T12:00:00.000Z`,
              bucketEnd: `2026-03-${day}T12:05:00.000Z`,
              stepCount: 1000 + index * 100,
              source: 'apple_health',
            };
          })}
          colorMode="gradient"
        />,
      );

      expect(await screen.findByText('1k')).toBeInTheDocument();
      const compactStepLabels = Array.from(container.querySelectorAll('.ui_chart_axis_unit'))
        .map((node) => node.textContent?.trim())
        .filter(Boolean);
      expect(compactStepLabels.some((label) => label === '2k' || label === '2k total')).toBe(true);
      expect(compactStepLabels).not.toContain('1k total');
    } finally {
      if (clientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  test('renders the steps band label and its info panel when step data exists', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxProxy) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    render(
      <GlucoseChart
        data={[
          { timestamp: '2026-03-25T12:00:00.000Z', valueMmolL: 5.8, source: 'official' },
          { timestamp: '2026-03-25T12:05:00.000Z', valueMmolL: 6.1, source: 'official' },
        ]}
        stepData={[
          {
            bucketStart: '2026-03-25T12:00:00.000Z',
            bucketEnd: '2026-03-25T12:05:00.000Z',
            stepCount: 123,
            source: 'apple_health',
          },
        ]}
        colorMode="gradient"
      />,
    );

    expect(screen.getByText('Steps')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Steps' }));
    expect(screen.getByText('Apple HealthKit')).toBeInTheDocument();
  });

  test('renders the workout band label and its info panel when workout data exists', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxProxy) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    render(
      <GlucoseChart
        data={[
          { timestamp: '2026-03-25T12:00:00.000Z', valueMmolL: 5.8, source: 'official' },
          { timestamp: '2026-03-25T12:05:00.000Z', valueMmolL: 6.1, source: 'official' },
        ]}
        workoutData={[
          {
            id: 'workout-1',
            startAt: '2026-03-25T11:00:00.000Z',
            endAt: '2026-03-25T12:00:00.000Z',
            workoutType: 'run',
            rawWorkoutType: 'running',
            displayName: 'Morning run',
            sourceSystem: 'apple_health',
            sourceId: 'apple-workout-1',
          },
        ]}
        colorMode="gradient"
      />,
    );

    expect(screen.getByText('Workouts')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Workouts' }));
    expect(screen.getByText('Apple Health and manual entry')).toBeInTheDocument();
  });

  test('renders an empty workout band even when there are no workout sessions', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxProxy) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    render(
      <GlucoseChart
        data={[
          { timestamp: '2026-03-25T12:00:00.000Z', valueMmolL: 5.8, source: 'official' },
          { timestamp: '2026-03-25T12:05:00.000Z', valueMmolL: 6.1, source: 'official' },
        ]}
        colorMode="gradient"
      />,
    );

    expect(screen.getByLabelText('Workouts band')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes band')).toBeInTheDocument();
    expect(screen.getByLabelText('Workouts band')).toHaveStyle({ borderRadius: '0px' });
    expect(screen.getByLabelText('Notes band')).toHaveStyle({ borderRadius: '0px' });
    expect(screen.queryByRole('button', { name: 'Add workout' })).not.toBeInTheDocument();
  });

  test('can render glucose only without workout or notes bands', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxProxy) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    render(
      <GlucoseChart
        data={[
          { timestamp: '2026-03-25T12:00:00.000Z', valueMmolL: 5.8, source: 'official' },
          { timestamp: '2026-03-25T12:05:00.000Z', valueMmolL: 6.1, source: 'official' },
        ]}
        colorMode="gradient"
        showWorkoutBand={false}
        showNoteBand={false}
      />,
    );

    expect(screen.queryByLabelText('Workouts band')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Notes band')).not.toBeInTheDocument();
    expect(screen.queryByText('Workouts')).not.toBeInTheDocument();
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
  });

  test('uses the available chart height for glucose only rendering', async () => {
    const fillRects: Array<[number, number, number, number]> = [];
    const recordingContext = new Proxy(
      {},
      {
        get: (_target, key) => {
          if (key === 'fillRect') {
            return (...args: [number, number, number, number]) => {
              fillRects.push(args);
            };
          }
          if (key === 'measureText') {
            return () => ({ width: 24 });
          }
          if (key === 'createLinearGradient') {
            return () => ({
              addColorStop: () => undefined
            });
          }
          return () => undefined;
        },
        set: () => true,
      },
    );
    HTMLCanvasElement.prototype.getContext = vi.fn(() => recordingContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 900;
      }
    });

    try {
      render(
        <GlucoseChart
          data={[
            { timestamp: '2026-03-25T12:00:00.000Z', valueMmolL: 5.8, source: 'official' },
            { timestamp: '2026-03-25T12:05:00.000Z', valueMmolL: 6.1, source: 'official' },
          ]}
          colorMode="gradient"
          height={640}
          showWorkoutBand={false}
          showNoteBand={false}
          yMax={18}
        />,
      );

      await waitFor(() => expect(fillRects).toContainEqual([48, 312, 828, 210]));
    } finally {
      if (clientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  test('places midnight labels on day support lines and centers full dates between them', async () => {
    const labels: Array<{ text: string; x: number; y: number }> = [];
    const recordingContext = new Proxy(
      {},
      {
        get: (_target, key) => {
          if (key === 'fillText') {
            return (text: string, x: number, y: number) => {
              labels.push({ text, x, y });
            };
          }
          if (key === 'measureText') {
            return () => ({ width: 24 });
          }
          if (key === 'createLinearGradient') {
            return () => ({
              addColorStop: () => undefined
            });
          }
          return () => undefined;
        },
        set: () => true,
      },
    );
    HTMLCanvasElement.prototype.getContext = vi.fn(() => recordingContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 900;
      }
    });

    try {
      const firstDayNoon = new Date(2026, 2, 25, 12).toISOString();
      const secondDayMidnight = new Date(2026, 2, 26, 0).toISOString();
      const secondDayNoon = new Date(2026, 2, 26, 12).toISOString();
      const thirdDayMidnight = new Date(2026, 2, 27, 0).toISOString();
      const thirdDayNoon = new Date(2026, 2, 27, 12).toISOString();

      render(
        <GlucoseChart
          data={[
            { timestamp: firstDayNoon, valueMmolL: 5.8, source: 'official' },
            { timestamp: secondDayMidnight, valueMmolL: 6.0, source: 'official' },
            { timestamp: secondDayNoon, valueMmolL: 6.1, source: 'official' },
            { timestamp: thirdDayMidnight, valueMmolL: 6.2, source: 'official' },
            { timestamp: thirdDayNoon, valueMmolL: 6.3, source: 'official' },
          ]}
          colorMode="gradient"
          showWorkoutBand={false}
          showNoteBand={false}
        />,
      );

      const firstDateLabel = new Date(2026, 2, 25).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const secondDateLabel = new Date(2026, 2, 26).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const midnightLabel = new Date(2026, 2, 26).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      await waitFor(() => {
        expect(labels).toEqual(expect.arrayContaining([
          expect.objectContaining({ text: firstDateLabel, y: 376 }),
          expect.objectContaining({ text: secondDateLabel, y: 376 }),
          expect.objectContaining({ text: midnightLabel, y: 360 }),
        ]));
      });

      const midnightPositions = new Set(
        labels
          .filter((label) => label.text === midnightLabel && label.y === 360)
          .map((label) => label.x),
      );
      expect(midnightPositions.size).toBe(2);
      expect(labels.find((label) => label.text === firstDateLabel)?.x).not.toBe(48);
    } finally {
      if (clientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  test('splits date labels into two lines only when the full label does not fit', async () => {
    const labels: Array<{ text: string; x: number; y: number }> = [];
    const recordingContext = new Proxy(
      {},
      {
        get: (_target, key) => {
          if (key === 'fillText') {
            return (text: string, x: number, y: number) => {
              labels.push({ text, x, y });
            };
          }
          if (key === 'measureText') {
            return (text: string) => ({
              width: text.includes('2026') && text !== '2026' ? 500 : 36,
            });
          }
          if (key === 'createLinearGradient') {
            return () => ({
              addColorStop: () => undefined
            });
          }
          return () => undefined;
        },
        set: () => true,
      },
    );
    HTMLCanvasElement.prototype.getContext = vi.fn(() => recordingContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 900;
      }
    });

    try {
      render(
        <GlucoseChart
          data={[
            { timestamp: new Date(2026, 5, 7, 12).toISOString(), valueMmolL: 5.8, source: 'official' },
            { timestamp: new Date(2026, 5, 8, 0).toISOString(), valueMmolL: 6.0, source: 'official' },
            { timestamp: new Date(2026, 5, 8, 12).toISOString(), valueMmolL: 6.1, source: 'official' },
          ]}
          colorMode="gradient"
          showWorkoutBand={false}
          showNoteBand={false}
        />,
      );

      const fullDateLabel = new Date(2026, 5, 7).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const dateLineOne = new Date(2026, 5, 7).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      });
      const dateLineTwo = new Date(2026, 5, 7).toLocaleDateString([], {
        year: 'numeric',
      });

      await waitFor(() => {
        expect(labels).toEqual(expect.arrayContaining([
          expect.objectContaining({ text: dateLineOne, y: 376 }),
          expect.objectContaining({ text: dateLineTwo, y: 388 }),
        ]));
      });

      expect(labels.some((label) => label.text === fullDateLabel)).toBe(false);
    } finally {
      if (clientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  test('does not draw overlapping time labels on dense ranges', async () => {
    const labels: Array<{ text: string; x: number; y: number }> = [];
    const recordingContext = new Proxy(
      {},
      {
        get: (_target, key) => {
          if (key === 'fillText') {
            return (text: string, x: number, y: number) => {
              labels.push({ text, x, y });
            };
          }
          if (key === 'measureText') {
            return (text: string) => ({
              width: /^\d/.test(text) ? 180 : Math.max(24, text.length * 8),
            });
          }
          if (key === 'createLinearGradient') {
            return () => ({
              addColorStop: () => undefined
            });
          }
          return () => undefined;
        },
        set: () => true,
      },
    );
    HTMLCanvasElement.prototype.getContext = vi.fn(() => recordingContext) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 1800;
      }
    });

    try {
      render(
        <GlucoseChart
          data={[
            { timestamp: new Date(2026, 5, 7, 12).toISOString(), valueMmolL: 5.8, source: 'official' },
            { timestamp: new Date(2026, 5, 8, 12).toISOString(), valueMmolL: 6.1, source: 'official' },
          ]}
          colorMode="gradient"
          showWorkoutBand={false}
          showNoteBand={false}
        />,
      );

      await waitFor(() => expect(labels.some((label) => label.y === 360)).toBe(true));

      const uniqueTimeLabels = Array.from(
        new Map(
          labels
            .filter((label) => label.y === 360)
            .map((label) => [`${label.text}-${label.x}`, label]),
        ).values(),
      ).sort((left, right) => left.x - right.x);

      for (let index = 1; index < uniqueTimeLabels.length; index += 1) {
        const previousRight = uniqueTimeLabels[index - 1].x + 90;
        const currentLeft = uniqueTimeLabels[index].x - 90;
        expect(currentLeft - previousRight).toBeGreaterThanOrEqual(10);
      }
    } finally {
      if (clientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  test('renders workout session blocks with their display label', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxProxy) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 900;
      }
    });

    try {
      render(
        <GlucoseChart
          data={[
            { timestamp: '2026-03-25T10:00:00.000Z', valueMmolL: 5.8, source: 'official' },
            { timestamp: '2026-03-25T13:00:00.000Z', valueMmolL: 6.1, source: 'official' },
          ]}
          workoutData={[
            {
              id: 'workout-1',
              startAt: '2026-03-25T11:00:00.000Z',
              endAt: '2026-03-25T12:00:00.000Z',
              workoutType: 'run',
              rawWorkoutType: 'running',
              displayName: 'Morning run',
              sourceSystem: 'apple_health',
              sourceId: 'apple-workout-1',
              activeEnergyKilocalories: 483.4,
              distanceMeters: 5120.7,
            },
          ]}
          colorMode="gradient"
        />,
      );

      expect(await screen.findByRole('button', { name: 'Morning run' })).toBeInTheDocument();
    } finally {
      if (clientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  test('keeps narrow workout sessions wide enough to center the icon', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxProxy) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 900;
      }
    });

    try {
      render(
        <GlucoseChart
          data={[
            { timestamp: '2026-03-18T10:00:00.000Z', valueMmolL: 5.8, source: 'official' },
            { timestamp: '2026-03-25T10:00:00.000Z', valueMmolL: 6.1, source: 'official' },
          ]}
          workoutData={[
            {
              id: 'workout-1',
              startAt: '2026-03-22T11:00:00.000Z',
              endAt: '2026-03-22T12:00:00.000Z',
              workoutType: 'run',
              rawWorkoutType: 'running',
              displayName: 'Short run',
              sourceSystem: 'apple_health',
              sourceId: 'apple-workout-1',
            },
          ]}
          colorMode="gradient"
        />,
      );

      expect(await screen.findByRole('button', { name: 'Short run' })).toHaveStyle({
        justifyContent: 'center',
        padding: '0px',
        width: '32px'
      });
      expect(screen.getByTitle('Short run icon').closest('svg')).toHaveClass('h-5', 'w-5');
    } finally {
      if (clientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  test('requests manual workout creation when owner clicks the workout band', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxProxy) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const onWorkoutAddRequest = vi.fn();

    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 900;
      }
    });

    try {
      render(
        <GlucoseChart
          data={[
            { timestamp: '2026-03-25T10:00:00.000Z', valueMmolL: 5.8, source: 'official' },
            { timestamp: '2026-03-25T14:00:00.000Z', valueMmolL: 6.1, source: 'official' },
          ]}
          colorMode="gradient"
          editable
          onWorkoutAddRequest={onWorkoutAddRequest}
        />,
      );

      fireEvent.click(await screen.findByLabelText('Workouts band'), { clientX: 450 });

      expect(onWorkoutAddRequest).toHaveBeenCalledTimes(1);
      expect(onWorkoutAddRequest.mock.calls[0]?.[0]).toMatch(/^2026-03-25T/);
    } finally {
      if (clientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  test('shows hovered workouts in the hover panel', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxProxy) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 900,
      bottom: 400,
      width: 900,
      height: 400,
      toJSON: () => ({})
    })) as unknown as typeof HTMLCanvasElement.prototype.getBoundingClientRect;

    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 900;
      }
    });

    try {
      render(
        <GlucoseChart
          data={[
            { timestamp: '2026-03-25T10:00:00.000Z', valueMmolL: 5.8, source: 'official' },
            { timestamp: '2026-03-25T14:00:00.000Z', valueMmolL: 6.1, source: 'official' },
          ]}
          workoutData={[
            {
              id: 'workout-1',
              startAt: '2026-03-25T11:00:00.000Z',
              endAt: '2026-03-25T12:00:00.000Z',
              workoutType: 'run',
              rawWorkoutType: 'running',
              displayName: 'Morning run',
              sourceSystem: 'apple_health',
              sourceId: 'apple-workout-1',
              activeEnergyKilocalories: 483.4,
              distanceMeters: 5120.7,
            },
          ]}
          colorMode="gradient"
        />,
      );

      fireEvent.mouseMove(document.querySelector('canvas')!, { clientX: 392, clientY: 120 });

      expect(await screen.findByText('Workout')).toBeInTheDocument();
      expect(screen.getAllByText('Morning run')).toHaveLength(2);
      expect(screen.getByText('483 kcal · 5.1 km')).toBeInTheDocument();
      expect(screen.getByText('Apple Health')).toBeInTheDocument();
    } finally {
      if (clientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  test('renders a workout plus button in the workout band at the hovered timestamp', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxProxy) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const onWorkoutAddRequest = vi.fn();

    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 900;
      }
    });

    try {
      render(
        <GlucoseChart
          data={[
            { timestamp: '2026-03-25T10:00:00.000Z', valueMmolL: 5.8, source: 'official' },
            { timestamp: '2026-03-25T14:00:00.000Z', valueMmolL: 6.1, source: 'official' },
          ]}
          colorMode="gradient"
          editable
          onWorkoutAddRequest={onWorkoutAddRequest}
        />,
      );

      fireEvent.mouseMove(await screen.findByLabelText('Workouts band'), { clientX: 450, clientY: 8 });
      fireEvent.click(await screen.findByRole('button', { name: 'Add workout' }));

      expect(onWorkoutAddRequest).toHaveBeenCalledTimes(1);
      expect(onWorkoutAddRequest.mock.calls[0]?.[0]).toMatch(/^2026-03-25T/);
    } finally {
      if (clientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  test('only shows the add button for the hovered timeline lane', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxProxy) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const onWorkoutAddRequest = vi.fn();
    const onNoteAddRequest = vi.fn();

    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 900;
      }
    });

    try {
      render(
        <GlucoseChart
          data={[
            { timestamp: '2026-03-25T10:00:00.000Z', valueMmolL: 5.8, source: 'official' },
            { timestamp: '2026-03-25T14:00:00.000Z', valueMmolL: 6.1, source: 'official' },
          ]}
          colorMode="gradient"
          editable
          onWorkoutAddRequest={onWorkoutAddRequest}
          onNoteAddRequest={onNoteAddRequest}
        />,
      );

      fireEvent.mouseMove(await screen.findByLabelText('Workouts band'), { clientX: 450, clientY: 8 });

      expect(await screen.findByRole('button', { name: 'Add workout' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add note' })).not.toBeInTheDocument();

      fireEvent.mouseMove(await screen.findByLabelText('Notes band'), { clientX: 450, clientY: 8 });

      expect(await screen.findByRole('button', { name: 'Add note' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add workout' })).not.toBeInTheDocument();
    } finally {
      if (clientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  test('renders workout type icons with a generic fallback', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxProxy) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 900;
      }
    });

    try {
      const { container } = render(
        <GlucoseChart
          data={[
            { timestamp: '2026-03-25T10:00:00.000Z', valueMmolL: 5.8, source: 'official' },
            { timestamp: '2026-03-25T15:00:00.000Z', valueMmolL: 6.1, source: 'official' },
          ]}
          workoutData={[
            {
              id: 'workout-1',
              startAt: '2026-03-25T11:00:00.000Z',
              endAt: '2026-03-25T12:00:00.000Z',
              workoutType: 'run',
              rawWorkoutType: 'running',
              displayName: 'Morning run',
              sourceSystem: 'apple_health',
              sourceId: 'apple-workout-1',
            },
            {
              id: 'workout-2',
              startAt: '2026-03-25T13:00:00.000Z',
              endAt: '2026-03-25T14:00:00.000Z',
              workoutType: 'other',
              rawWorkoutType: 'pickleball',
              displayName: 'Lunch game',
              sourceSystem: 'manual',
              sourceId: null,
            },
          ]}
          colorMode="gradient"
        />,
      );

      expect(await screen.findByRole('button', { name: 'Morning run' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Lunch game' })).toBeInTheDocument();

      const iconRefs = Array.from(container.querySelectorAll('use')).map((node) => node.getAttribute('href'));
      expect(iconRefs).toContain('/static_assets/iconSprite.svg#workout-run');
      expect(iconRefs).toContain('/static_assets/iconSprite.svg#activity');
    } finally {
      if (clientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      } else {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  test('does not move note overlays on wheel input', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxProxy) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 900,
      bottom: 400,
      width: 900,
      height: 400,
      toJSON: () => ({})
    })) as unknown as typeof HTMLCanvasElement.prototype.getBoundingClientRect;

    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 900;
      }
    });

    try {
      render(
        <GlucoseChart
          data={[
            { timestamp: '2026-03-25T12:00:00.000Z', valueMmolL: 5.8, source: 'official' },
            { timestamp: '2026-03-25T13:00:00.000Z', valueMmolL: 6.1, source: 'official' },
          ]}
          noteData={[
            {
              id: 'note-1',
              text: 'Fixed note',
              startAt: '2026-03-25T12:15:00.000Z',
              endAt: '2026-03-25T12:30:00.000Z',
              timezone: 'Europe/Stockholm',
              allDay: false,
              authorType: 'user',
              source: null,
              createdAt: '2026-03-25T12:00:00.000Z',
              updatedAt: '2026-03-25T12:00:00.000Z',
              createdBy: 'admin',
              updatedBy: 'admin'
            }
          ]}
          colorMode="gradient"
        />,
      );

      const noteButton = await screen.findByRole('button', { name: 'Fixed note' });
      const initialLeft = noteButton.style.left;
      const canvas = document.querySelector('canvas');

      expect(canvas).not.toBeNull();

      const commandWheelEvent = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        deltaY: -120,
      });
      Object.defineProperty(commandWheelEvent, 'offsetX', {
        configurable: true,
        value: 450
      });

      const horizontalWheelEvent = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaX: 120,
      });

      canvas!.dispatchEvent(commandWheelEvent);
      canvas!.dispatchEvent(horizontalWheelEvent);

      expect(commandWheelEvent.defaultPrevented).toBe(false);
      expect(horizontalWheelEvent.defaultPrevented).toBe(false);
      expect(noteButton.style.left).toBe(initialLeft);
    } finally {
      if (clientWidth) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth);
      } else {
        // Keep the prototype clean if the runtime did not define clientWidth directly.
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  test('does not render note resize handles for selected notes', async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxProxy) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    render(
      <GlucoseChart
        data={[
          { timestamp: '2026-03-25T12:00:00.000Z', valueMmolL: 5.8, source: 'official' },
          { timestamp: '2026-03-25T13:00:00.000Z', valueMmolL: 6.1, source: 'official' },
        ]}
        noteData={[
          {
            id: 'note-1',
            text: 'No resize',
            startAt: '2026-03-25T12:15:00.000Z',
            endAt: '2026-03-25T12:30:00.000Z',
            timezone: 'Europe/Stockholm',
            allDay: false,
            authorType: 'user',
            source: null,
            createdAt: '2026-03-25T12:00:00.000Z',
            updatedAt: '2026-03-25T12:00:00.000Z',
            createdBy: 'admin',
            updatedBy: 'admin'
          }
        ]}
        colorMode="gradient"
        selectedNoteId="note-1"
      />,
    );

    await screen.findByRole('button', { name: 'No resize' });

    expect(screen.queryByLabelText('Resize note start')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Resize note end')).not.toBeInTheDocument();
  });
});
