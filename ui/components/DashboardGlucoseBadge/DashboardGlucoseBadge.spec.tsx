// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DashboardGlucoseBadge } from './DashboardGlucoseBadge';

const indicatorProps = vi.fn();
const listeners = new Map<string, (event: Event) => void>();

vi.mock('@ui/components/GlucoseIndicator/GlucoseIndicator', () => ({
  GlucoseIndicator: (props: unknown) => {
    indicatorProps(props);
    return <div data-testid="glucose-indicator" />;
  },
}));

class EventSourceMock {
  addEventListener(type: string, listener: (event: Event) => void) {
    listeners.set(type, listener);
  }

  close() {}
}

describe('DashboardGlucoseBadge', () => {
  beforeEach(() => {
    indicatorProps.mockClear();
    listeners.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        latest: {
          valueMmolL: 5.8,
          trend: 'stable',
          timestamp: '2026-03-25T12:00:00.000Z',
        },
      }),
    }));
    vi.stubGlobal('EventSource', EventSourceMock as unknown as typeof EventSource);
  });

  test('loads the latest reading and renders the glucose indicator', async () => {
    render(<DashboardGlucoseBadge />);

    await waitFor(() => {
      expect(screen.getByTestId('glucose-indicator')).toBeInTheDocument();
    });

    expect(indicatorProps).toHaveBeenCalledWith(expect.objectContaining({
      value: 5.8,
      trend: 'stable',
      showAge: false,
    }));
  });

  test('skips stream setup when streaming is disabled', async () => {
    const eventSourceSpy = vi.fn();

    class DisabledStreamEventSourceMock {
      constructor() {
        eventSourceSpy();
      }

      addEventListener() {}

      close() {}
    }

    vi.stubGlobal('EventSource', DisabledStreamEventSourceMock as unknown as typeof EventSource);

    render(<DashboardGlucoseBadge enableStream={false} pollIntervalMs={5_000} />);

    await waitFor(() => {
      expect(screen.getByTestId('glucose-indicator')).toBeInTheDocument();
    });

    expect(eventSourceSpy).not.toHaveBeenCalled();
  });
});
