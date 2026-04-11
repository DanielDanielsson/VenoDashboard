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
