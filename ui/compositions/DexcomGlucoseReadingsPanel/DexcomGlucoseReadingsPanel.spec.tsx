// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ReactElement } from 'react';
import { fireEvent, render as renderTestingLibrary, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { serializeTimeRangeClipboardValue } from '@/lib/glucose/time-range-clipboard';
import { NotificationsProvider } from '@ui/compositions/NotificationsProvider';

const UplotGlucoseChart = vi.fn((props: {
  data: Array<{ timestamp: string; valueMmolL: number }>;
  renderMode?: 'auto' | 'line' | 'points';
  onPointSelect?: (point: { timestamp: string; valueMmolL: number }) => void;
  onZoomWindowChange?: (window: { from: string; to: string } | null) => void;
}) => (
  <div data-testid="glucose-chart">
    {props.data.map((point) => (
      <button
        key={point.timestamp}
        type="button"
        onClick={() => props.onPointSelect?.(point)}
      >
        {point.timestamp}
      </button>
    ))}
    <button
      type="button"
      onClick={() => props.onZoomWindowChange?.({
        from: '2026-03-07T10:30:00.000Z',
        to: '2026-03-07T11:00:00.000Z',
      })}
    >
      zoom-selection
    </button>
    <button type="button" onClick={() => props.onZoomWindowChange?.(null)}>
      zoom-out
    </button>
  </div>
));

vi.mock('@ui/components/UplotGlucoseChart', () => ({
  UplotGlucoseChart,
}));

const render = (ui: ReactElement) => {
  const cache = new Map();
  const provider = () => cache;
  const result = renderTestingLibrary(
    <SWRConfig value={{ provider }}>
      <NotificationsProvider>
        {ui}
      </NotificationsProvider>
    </SWRConfig>,
  );

  return {
    ...result,
    rerender: (nextUi: ReactElement) => result.rerender(
      <SWRConfig value={{ provider }}>
        <NotificationsProvider>
          {nextUi}
        </NotificationsProvider>
      </SWRConfig>,
    ),
  };
};

describe('DexcomGlucoseReadingsPanel', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    fetchMock.mockReset();
    // A Response body is single-use, so build a fresh one per fetch call.
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      items: [
        {
          readingId: 'official-1',
          timestamp: '2026-03-07T10:00:00.000Z',
          valueMmolL: 6.1,
          valueMgDl: 110,
          trend: 'flat',
          source: 'official',
        },
      ],
      meta: {
        from: '2026-03-07T10:00:00.000Z',
        to: '2026-03-07T12:00:00.000Z',
        resolution: {
          mode: 'raw',
          intervalMs: 60_000,
          maxDataPoints: 512,
          returnedPoints: 1,
        },
        capabilities: {
          correctionsAllowed: true,
        },
      },
    }), { status: 200 }));
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 512,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test('fetches optimized glucose readings for the selected dashboard window and renders one mmol series', async () => {
    const { DexcomGlucoseReadingsPanel } = await import('./DexcomGlucoseReadingsPanel');

    render(
      <DexcomGlucoseReadingsPanel
        timeWindow={{
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        }}
        settings={{
          colorMode: 'standard',
          yAxisMax: 18,
        }}
      />,
    );

    await screen.findByTestId('glucose-chart');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/glucose/readings-series?from=2026-03-07T10%3A00%3A00.000Z&to=2026-03-07T12%3A00%3A00.000Z&maxDataPoints=512',
      expect.objectContaining({ cache: 'no-store' }),
    );
    await waitFor(() => expect(UplotGlucoseChart).toHaveBeenCalled());
    expect(UplotGlucoseChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ariaLabel: 'Dexcom G7 glucose readings chart',
        colorMode: 'standard',
        editable: false,
        glucoseUnit: 'mmol/L',
        height: 320,
        renderMode: 'points',
        timeWindow: {
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        },
        yMax: 18,
        data: [
          {
            readingId: 'official-1',
            timestamp: '2026-03-07T10:00:00.000Z',
            valueMgDl: 110,
            valueMmolL: 6.1,
            trend: 'flat',
            source: 'official',
          },
        ],
      }),
      undefined,
    );
  });

  test('requests enough points to preserve seven day CGM cadence readings in narrow panels', async () => {
    const { DexcomGlucoseReadingsPanel } = await import('./DexcomGlucoseReadingsPanel');

    render(
      <DexcomGlucoseReadingsPanel
        timeWindow={{
          from: '2026-03-01T00:00:00.000Z',
          to: '2026-03-08T00:00:00.000Z',
        }}
      />,
    );

    await screen.findByTestId('glucose-chart');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/glucose/readings-series?from=2026-03-01T00%3A00%3A00.000Z&to=2026-03-08T00%3A00%3A00.000Z&maxDataPoints=2018',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  test('dedupes identical in-flight readings requests across panel instances', async () => {
    const { DexcomGlucoseReadingsPanel } = await import('./DexcomGlucoseReadingsPanel');

    render(
      <>
        <DexcomGlucoseReadingsPanel
          panelId="panel-dexcom-glucose-readings-a"
          timeWindow={{
            from: '2026-03-07T10:00:00.000Z',
            to: '2026-03-07T12:00:00.000Z',
          }}
        />
        <DexcomGlucoseReadingsPanel
          panelId="panel-dexcom-glucose-readings-b"
          timeWindow={{
            from: '2026-03-07T10:00:00.000Z',
            to: '2026-03-07T12:00:00.000Z',
          }}
        />
      </>,
    );

    await screen.findAllByTestId('glucose-chart');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('opens a correction form for editable raw glucose points', async () => {
    const { DexcomGlucoseReadingsPanel } = await import('./DexcomGlucoseReadingsPanel');

    render(
      <DexcomGlucoseReadingsPanel
        isOwner
        timeWindow={{
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        }}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: '2026-03-07T10:00:00.000Z' }));

    expect(screen.getByRole('heading', { name: 'Correct reading' })).toBeInTheDocument();
    expect(screen.getByText('Original 6.1 mmol/L')).toBeInTheDocument();
    expect(screen.getByText('Current 6.1 mmol/L')).toBeInTheDocument();
    expect(screen.getByLabelText('Corrected glucose value in mmol/L')).toHaveValue(6.1);
  });

  test('submits a glucose correction and refreshes optimized readings', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            readingId: 'official-1',
            timestamp: '2026-03-07T10:00:00.000Z',
            valueMmolL: 6.1,
            valueMgDl: 110,
            trend: 'flat',
            source: 'official',
          },
        ],
        meta: {
          capabilities: {
            correctionsAllowed: true,
          },
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ updated: 1, cleared: 0 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            readingId: 'official-1',
            timestamp: '2026-03-07T10:00:00.000Z',
            valueMmolL: 5.4,
            valueMgDl: 97,
            originalValueMmolL: 6.1,
            isCorrected: true,
            correctionReason: 'Compression low',
            trend: 'flat',
            source: 'official',
          },
        ],
        meta: {
          capabilities: {
            correctionsAllowed: true,
          },
        },
      }), { status: 200 }));
    const { DexcomGlucoseReadingsPanel } = await import('./DexcomGlucoseReadingsPanel');

    render(
      <DexcomGlucoseReadingsPanel
        isOwner
        timeWindow={{
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        }}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: '2026-03-07T10:00:00.000Z' }));
    fireEvent.change(screen.getByLabelText('Corrected glucose value in mmol/L'), {
      target: { value: '5.4' },
    });
    fireEvent.change(screen.getByLabelText('Correction reason'), {
      target: { value: 'Compression low' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save correction' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/dashboard/glucose/corrections',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          items: [
            {
              source: 'official',
              readingId: 'official-1',
              valueMmolL: 5.4,
              reason: 'Compression low',
            },
          ],
        }),
      }),
    );
    await waitFor(() => expect(UplotGlucoseChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            valueMmolL: 5.4,
          }),
        ],
      }),
      undefined,
    ));
  });

  test('clears an existing glucose correction and refreshes optimized readings', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            readingId: 'official-1',
            timestamp: '2026-03-07T10:00:00.000Z',
            valueMmolL: 5.4,
            valueMgDl: 97,
            originalValueMmolL: 6.1,
            isCorrected: true,
            correctionReason: 'Compression low',
            trend: 'flat',
            source: 'official',
          },
        ],
        meta: {
          capabilities: {
            correctionsAllowed: true,
          },
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ updated: 0, cleared: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            readingId: 'official-1',
            timestamp: '2026-03-07T10:00:00.000Z',
            valueMmolL: 6.1,
            valueMgDl: 110,
            trend: 'flat',
            source: 'official',
          },
        ],
        meta: {
          capabilities: {
            correctionsAllowed: true,
          },
        },
      }), { status: 200 }));
    const { DexcomGlucoseReadingsPanel } = await import('./DexcomGlucoseReadingsPanel');

    render(
      <DexcomGlucoseReadingsPanel
        isOwner
        timeWindow={{
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        }}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: '2026-03-07T10:00:00.000Z' }));
    await waitFor(() => expect(UplotGlucoseChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            isCorrected: true,
            valueMmolL: 5.4,
          }),
        ],
      }),
      undefined,
    ));
    expect(screen.getByText('Original 6.1 mmol/L')).toBeInTheDocument();
    expect(screen.getByText('Current 5.4 mmol/L')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear correction' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/dashboard/glucose/corrections',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          items: [
            {
              source: 'official',
              readingId: 'official-1',
              valueMmolL: null,
              reason: null,
            },
          ],
        }),
      }),
    );
    await waitFor(() => expect(UplotGlucoseChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            valueMmolL: 6.1,
          }),
        ],
      }),
      undefined,
    ));
  });

  test('does not open correction editing when optimized readings are reduced', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      items: [
        {
          timestamp: '2026-03-07T10:00:00.000Z',
          valueMmolL: 6.1,
          valueMgDl: 110,
          trend: 'flat',
          source: 'official',
        },
      ],
      meta: {
        resolution: {
          mode: 'reduced',
        },
        capabilities: {
          correctionsAllowed: false,
        },
      },
    }), { status: 200 }));
    const { DexcomGlucoseReadingsPanel } = await import('./DexcomGlucoseReadingsPanel');

    render(
      <DexcomGlucoseReadingsPanel
        isOwner
        timeWindow={{
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        }}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: '2026-03-07T10:00:00.000Z' }));

    await waitFor(() => expect(UplotGlucoseChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        renderMode: 'line',
      }),
      undefined,
    ));
    expect(screen.queryByRole('heading', { name: 'Correct reading' })).not.toBeInTheDocument();
  });

  test('zoom selection refetches the narrower window and reset restores cached dashboard data', async () => {
    const { DexcomGlucoseReadingsPanel } = await import('./DexcomGlucoseReadingsPanel');

    render(
      <DexcomGlucoseReadingsPanel
        timeWindow={{
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        }}
      />,
    );

    await screen.findByTestId('glucose-chart');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'zoom-selection' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/dashboard/glucose/readings-series?from=2026-03-07T10%3A30%3A00.000Z&to=2026-03-07T11%3A00%3A00.000Z&maxDataPoints=512',
      expect.objectContaining({ cache: 'no-store' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy time range' }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      serializeTimeRangeClipboardValue({
        from: '2026-03-07T10:30:00.000Z',
        to: '2026-03-07T11:00:00.000Z',
      }),
    ));

    fireEvent.click(await screen.findByRole('button', { name: 'Reset zoom' }));

    expect(screen.queryByRole('button', { name: 'Copy time range' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset zoom' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(UplotGlucoseChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        timeWindow: {
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        },
      }),
      undefined,
    ));
  });

  test('reuses cached relative range data when the resolved window changes', async () => {
    const { DexcomGlucoseReadingsPanel } = await import('./DexcomGlucoseReadingsPanel');

    const { rerender } = render(
      <DexcomGlucoseReadingsPanel
        timeWindow={{
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-06-05T10:00:00.000Z',
        }}
        timeWindowCacheKey="raw:now-90d:now:Europe/Stockholm"
      />,
    );

    await screen.findByTestId('glucose-chart');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender(
      <DexcomGlucoseReadingsPanel
        timeWindow={{
          from: '2026-05-06T10:00:15.000Z',
          to: '2026-06-05T10:00:15.000Z',
        }}
        timeWindowCacheKey="raw:now-30d:now:Europe/Stockholm"
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    rerender(
      <DexcomGlucoseReadingsPanel
        timeWindow={{
          from: '2026-03-07T10:00:30.000Z',
          to: '2026-06-05T10:00:30.000Z',
        }}
        timeWindowCacheKey="raw:now-90d:now:Europe/Stockholm"
      />,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(UplotGlucoseChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        timeWindow: {
          from: '2026-03-07T10:00:30.000Z',
          to: '2026-06-05T10:00:30.000Z',
        },
      }),
      undefined,
    ));
  });

  test('double-click zoom-out from the chart restores the dashboard window', async () => {
    const { DexcomGlucoseReadingsPanel } = await import('./DexcomGlucoseReadingsPanel');

    render(
      <DexcomGlucoseReadingsPanel
        timeWindow={{
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        }}
      />,
    );

    await screen.findByTestId('glucose-chart');
    fireEvent.click(screen.getByRole('button', { name: 'zoom-selection' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: 'zoom-out' }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(UplotGlucoseChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        timeWindow: {
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        },
      }),
      undefined,
    ));
  });

  test('refetches optimized readings when dashboard refresh revision changes', async () => {
    const { DexcomGlucoseReadingsPanel } = await import('./DexcomGlucoseReadingsPanel');

    const { rerender } = render(
      <DexcomGlucoseReadingsPanel
        refreshRevision={0}
        timeWindow={{
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        }}
      />,
    );

    await screen.findByTestId('glucose-chart');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender(
      <DexcomGlucoseReadingsPanel
        refreshRevision={1}
        timeWindow={{
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        }}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  test('refetches optimized readings only when the panel gets wider', async () => {
    let panelWidth = 512;
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return panelWidth;
      },
    });
    const { DexcomGlucoseReadingsPanel } = await import('./DexcomGlucoseReadingsPanel');

    render(
      <DexcomGlucoseReadingsPanel
        timeWindow={{
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        }}
      />,
    );

    await screen.findByTestId('glucose-chart');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    panelWidth = 420;
    window.dispatchEvent(new Event('resize'));

    await new Promise((resolve) => {
      window.setTimeout(resolve, 200);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    panelWidth = 768;
    window.dispatchEvent(new Event('resize'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/dashboard/glucose/readings-series?from=2026-03-07T10%3A00%3A00.000Z&to=2026-03-07T12%3A00%3A00.000Z&maxDataPoints=768',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  test('uses persisted panel settings by panel id with safe defaults', async () => {
    vi.resetModules();
    const useDashboardPanelSettings = vi.fn((_panelId: string, defaults: { yAxisMax: number }) => [
      {
        ...defaults,
        yAxisMax: 22,
      },
      vi.fn(),
    ]);
    vi.doMock('@ui/compositions/DashboardGrid', () => ({
      useDashboardPanelSettings,
    }));
    vi.doMock('@ui/compositions/NotificationsProvider', () => ({
      useNotifications: () => ({
        notifyError: vi.fn(),
        notifySuccess: vi.fn(),
      }),
    }));
    const { DexcomGlucoseReadingsPanel } = await import('./DexcomGlucoseReadingsPanel');

    render(
      <DexcomGlucoseReadingsPanel
        panelId="panel-dexcom-glucose-readings"
        timeWindow={{
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        }}
      />,
    );

    await screen.findByTestId('glucose-chart');

    expect(useDashboardPanelSettings).toHaveBeenCalledWith(
      'panel-dexcom-glucose-readings',
      expect.objectContaining({
        colorMode: 'standard',
        unit: 'global',
        yAxisMax: 18,
      }),
    );
    expect(UplotGlucoseChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        yMax: 22,
      }),
      undefined,
    );
  });

  test('resolves the chart unit from global settings unless overridden', async () => {
    vi.resetModules();
    const useDashboardPanelSettings = vi.fn((_panelId: string, defaults: { unit: string }) => [
      defaults,
      vi.fn(),
    ]);
    vi.doMock('@ui/compositions/DashboardGrid', () => ({
      useDashboardPanelSettings,
    }));
    vi.doMock('@ui/compositions/NotificationsProvider', () => ({
      useNotifications: () => ({
        notifyError: vi.fn(),
        notifySuccess: vi.fn(),
      }),
    }));
    const {
      DexcomGlucoseReadingsPanel,
      resolveDexcomGlucoseReadingsPanelUnit,
    } = await import('./DexcomGlucoseReadingsPanel');

    expect(resolveDexcomGlucoseReadingsPanelUnit('global', 'mg/dL')).toBe('mg/dL');
    expect(resolveDexcomGlucoseReadingsPanelUnit('mmol/L', 'mg/dL')).toBe('mmol/L');

    render(
      <DexcomGlucoseReadingsPanel
        globalGlucoseUnit="mg/dL"
        timeWindow={{
          from: '2026-03-07T10:00:00.000Z',
          to: '2026-03-07T12:00:00.000Z',
        }}
      />,
    );

    await screen.findByTestId('glucose-chart');

    expect(UplotGlucoseChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        glucoseUnit: 'mg/dL',
      }),
      undefined,
    );
  });
});
