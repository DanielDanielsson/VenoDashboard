// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { GlucoseChart } from './GlucoseChart';

const ctxProxy = new Proxy(
  {},
  {
    get: (_target, key) => {
      if (key === 'measureText') {
        return () => ({ width: 24 });
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
});
