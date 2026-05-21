// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
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

vi.mock('@ui/components/DataFreshnessLight/DataFreshnessLight', () => ({
  DataFreshnessLight: ({ timestamp }: { timestamp?: string | null }) => (
    <span data-testid="freshness-light">{timestamp}</span>
  ),
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              readingId: 'previous-reading',
              valueMmolL: 5.5,
              timestamp: '2026-03-25T11:55:00.000Z',
            },
            {
              readingId: 'latest-reading',
              valueMmolL: 5.8,
              timestamp: '2026-03-25T12:00:00.000Z',
            },
          ],
          latest: {
            id: 'latest-reading',
            valueMmolL: 5.8,
            trend: 'stable',
            timestamp: '2026-03-25T12:00:00.000Z',
          },
        }),
      }),
    );
    vi.stubGlobal(
      'EventSource',
      EventSourceMock as unknown as typeof EventSource,
    );
  });

  test('loads the latest reading and renders the glucose indicator', async () => {
    render(<DashboardGlucoseBadge />);

    await waitFor(() => {
      expect(screen.getByTestId('glucose-indicator')).toBeInTheDocument();
    });

    expect(indicatorProps).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 5.8,
        trend: 'stable',
        displayValue: '5.8',
        showAge: false,
        showUnit: true,
        fitToContainer: false,
        colorMode: 'standard',
        unit: 'mmol/L',
      }),
    );
  });

  test('passes the configured color mode into the glucose indicator', async () => {
    render(<DashboardGlucoseBadge colorMode="gradient" />);

    await waitFor(() => {
      expect(screen.getByTestId('glucose-indicator')).toBeInTheDocument();
    });

    expect(indicatorProps).toHaveBeenCalledWith(
      expect.objectContaining({
        colorMode: 'gradient',
      }),
    );
  });

  test('can render the glucose indicator in container fit mode', async () => {
    render(<DashboardGlucoseBadge fitToContainer />);

    await waitFor(() => {
      expect(screen.getByTestId('glucose-indicator')).toBeInTheDocument();
    });

    expect(indicatorProps).toHaveBeenCalledWith(
      expect.objectContaining({
        fitToContainer: true,
      }),
    );
  });

  test('renders unit, freshness, diff, and source details aligned above the glucose indicator', async () => {
    render(<DashboardGlucoseBadge fitToContainer showDetails />);

    await waitFor(() => {
      expect(screen.getByTestId('glucose-indicator')).toBeInTheDocument();
    });

    expect(indicatorProps).toHaveBeenCalledWith(
      expect.objectContaining({
        showUnit: false,
        fitToContainer: true,
        fitPlacement: 'center',
        displayValue: '5.8',
        unit: 'mmol/L',
      }),
    );
    expect(screen.getByText('Unit')).toBeInTheDocument();
    expect(screen.getByText('mmol/L')).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
    expect(screen.getByText('Diff')).toBeInTheDocument();
    expect(screen.getByText('+0.3')).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Dexcom Share API')).toBeInTheDocument();
    expect(screen.getByText('Unit').closest('dl')).toHaveClass('text-left');
    expect(screen.getByText('Unit').closest('dl')).not.toHaveClass('absolute');
    expect(screen.getByText('Unit').closest('dl')?.parentElement).toHaveClass(
      'content-center',
      'justify-items-center',
      'overflow-hidden',
    );
    expect(screen.getByText('Unit').closest('dl')).toHaveClass(
      'justify-self-center',
    );
    expect(screen.getByTestId('glucose-indicator').parentElement).toHaveClass(
      'place-items-center',
    );
    expect(screen.getByTestId('glucose-indicator').parentElement).not.toHaveClass(
      'pl-32',
    );
    expect(screen.getByText('Unit').parentElement).toHaveClass(
      'grid-cols-[7rem_minmax(0,1fr)]',
      'items-baseline',
    );
    expect(screen.getByTestId('freshness-light')).toHaveTextContent(
      '2026-03-25T12:00:00.000Z',
    );
  });

  test('can render the current glucose value and diff in mg/dL', async () => {
    render(
      <DashboardGlucoseBadge
        fitToContainer
        glucoseUnit="mg/dL"
        showDetails
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('glucose-indicator')).toBeInTheDocument();
    });

    expect(indicatorProps).toHaveBeenCalledWith(
      expect.objectContaining({
        displayValue: '105',
        unit: 'mg/dL',
      }),
    );
    expect(screen.getByText('mg/dL')).toBeInTheDocument();
    expect(screen.getByText('+5')).toBeInTheDocument();
  });

  test('can align the metadata and glucose indicator horizontally', async () => {
    render(
      <DashboardGlucoseBadge
        contentAlignment="horizontal"
        fitToContainer
        showDetails
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('glucose-indicator')).toBeInTheDocument();
    });

    expect(screen.getByText('Unit').closest('dl')?.parentElement).toHaveClass(
      'items-center',
      'justify-center',
      'gap-8',
    );
    expect(screen.getByText('Unit').closest('dl')).toHaveClass(
      'content-center',
      'justify-self-end',
    );
    expect(screen.getByTestId('glucose-indicator').parentElement).toHaveClass(
      'place-items-center',
    );
    expect(screen.getByTestId('glucose-indicator').parentElement).toHaveStyle({
      height: 'min(72cqh, 40rem)',
      width: 'min(72cqh, 40rem)',
    });
  });

  test('updates the diff from the previous latest reading on stream updates', async () => {
    render(<DashboardGlucoseBadge showDetails />);

    await waitFor(() => {
      expect(screen.getByText('+0.3')).toBeInTheDocument();
    });

    act(() => {
      listeners.get('glucose_update')?.(
        new MessageEvent('glucose_update', {
          data: JSON.stringify({
            valueMmolL: 6.0,
            trend: 'up',
            timestamp: '2026-03-25T12:05:00.000Z',
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('+0.2')).toBeInTheDocument();
    });
  });

  test('keeps the last reading visible across remounts', async () => {
    const { unmount } = render(<DashboardGlucoseBadge />);

    await waitFor(() => {
      expect(screen.getByTestId('glucose-indicator')).toBeInTheDocument();
    });

    unmount();
    render(<DashboardGlucoseBadge />);

    expect(screen.getByTestId('glucose-indicator')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('glucose-indicator')).toBeInTheDocument();
    });
  });

  test('only renders enabled metadata labels', async () => {
    render(
      <DashboardGlucoseBadge
        showDetails
        metadataVisibility={{
          showUnit: false,
          showUpdated: true,
          showDiff: false,
          showSource: false,
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('glucose-indicator')).toBeInTheDocument();
    });

    expect(screen.queryByText('Unit')).not.toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
    expect(screen.queryByText('Diff')).not.toBeInTheDocument();
    expect(screen.queryByText('Source')).not.toBeInTheDocument();
  });

  test('centers the glucose indicator when no metadata labels are visible', async () => {
    render(
      <DashboardGlucoseBadge
        showDetails
        metadataVisibility={{
          showUnit: false,
          showUpdated: false,
          showDiff: false,
          showSource: false,
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('glucose-indicator')).toBeInTheDocument();
    });

    expect(screen.queryByText('Unit')).not.toBeInTheDocument();
    expect(screen.getByTestId('glucose-indicator').parentElement).not.toHaveClass(
      'pl-32',
    );
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

    vi.stubGlobal(
      'EventSource',
      DisabledStreamEventSourceMock as unknown as typeof EventSource,
    );

    render(
      <DashboardGlucoseBadge enableStream={false} pollIntervalMs={5_000} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('glucose-indicator')).toBeInTheDocument();
    });

    expect(eventSourceSpy).not.toHaveBeenCalled();
  });
});
