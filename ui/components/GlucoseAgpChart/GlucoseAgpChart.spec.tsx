// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { GlucoseAgpChart } from './GlucoseAgpChart';

describe('GlucoseAgpChart', () => {
  test('connects sparse optimized AGP readings across empty time buckets', () => {
    const { container } = render(
      <GlucoseAgpChart
        data={[
          { timestamp: '2026-03-24T00:00:00.000Z', valueMmolL: 5.4, source: 'official' },
          { timestamp: '2026-03-25T06:00:00.000Z', valueMmolL: 7.2, source: 'official' },
          { timestamp: '2026-03-26T12:00:00.000Z', valueMmolL: 6.1, source: 'share' },
        ]}
      />,
    );

    const connectedLinePaths = [...container.querySelectorAll('path[fill="none"]')]
      .map((path) => path.getAttribute('d') ?? '')
      .filter((path) => path.includes(' L '));

    expect(connectedLinePaths.length).toBeGreaterThan(0);
  });

  test('shows the disabled message when coverage is 24 hours or less', () => {
    render(
      <GlucoseAgpChart
        data={[
          { timestamp: '2026-03-24T00:00:00.000Z', valueMmolL: 5.4, source: 'official' },
          { timestamp: '2026-03-24T23:00:00.000Z', valueMmolL: 5.8, source: 'official' },
        ]}
      />,
    );

    expect(screen.getByText('A wider time range needs to be selected in order for the AGP profile to work.')).toBeInTheDocument();
  });
});
