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
        return 900;
      }
    });

    try {
      render(
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
      expect(screen.getByText('2k')).toBeInTheDocument();
      expect(screen.queryByText('1k total')).not.toBeInTheDocument();
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
            },
          ]}
          colorMode="gradient"
        />,
      );

      fireEvent.mouseMove(document.querySelector('canvas')!, { clientX: 392, clientY: 120 });

      expect(await screen.findByText('Workout')).toBeInTheDocument();
      expect(screen.getAllByText('Morning run')).toHaveLength(2);
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

  test('repositions note overlays during wheel zoom', async () => {
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
              text: 'Zoom note',
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

      const noteButton = await screen.findByRole('button', { name: 'Zoom note' });
      const initialLeft = noteButton.style.left;
      const canvas = document.querySelector('canvas');

      expect(canvas).not.toBeNull();

      const wheelEvent = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        deltaY: -120,
      });
      Object.defineProperty(wheelEvent, 'offsetX', {
        configurable: true,
        value: 450
      });

      canvas!.dispatchEvent(wheelEvent);

      await waitFor(() => {
        expect(noteButton.style.left).not.toBe(initialLeft);
      });
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
