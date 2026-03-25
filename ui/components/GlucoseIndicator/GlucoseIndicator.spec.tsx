// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { GlucoseIndicator } from './GlucoseIndicator';

describe('GlucoseIndicator', () => {
  test('shows stale placeholder when the reading is too old', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T12:20:00.000Z'));

    render(
      <GlucoseIndicator
        value={5.4}
        trend="stable"
        timestamp="2026-03-25T12:00:00.000Z"
      />,
    );

    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.getByText('20m ago')).toBeInTheDocument();

    vi.useRealTimers();
  });
});
