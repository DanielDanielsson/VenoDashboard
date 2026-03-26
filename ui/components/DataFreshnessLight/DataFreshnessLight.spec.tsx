// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DataFreshnessLight } from './DataFreshnessLight';

describe('DataFreshnessLight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-25T12:00:30.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('shows the current age and reacts to glucose update events', () => {
    render(<DataFreshnessLight timestamp="2026-03-25T12:00:00.000Z" />);

    expect(screen.getByText('30s')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent('pulse-glucose-latest', {
        detail: { timestamp: '2026-03-25T12:00:20.000Z' },
      }));
    });

    expect(screen.getByText('10s')).toBeInTheDocument();
  });

  test('shows a fallback label when no timestamp is provided', () => {
    render(<DataFreshnessLight fallbackLabel="Rendering now" autoUpdateEventName={null} status="fresh" />);

    expect(screen.getByText('Rendering now')).toBeInTheDocument();
  });
});
