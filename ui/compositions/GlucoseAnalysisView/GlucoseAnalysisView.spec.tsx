// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GlucoseAnalysisView } from './GlucoseAnalysisView';

const historyMutateMock = vi.fn();
const useSWRMock = vi.fn();
const swrCache = new Map<string, { data?: unknown }>();

vi.mock('swr', () => ({
  __esModule: true,
  default: function useSWR(...args: unknown[]) {
    return useSWRMock(...args);
  },
  useSWRConfig() {
    return {
      cache: swrCache
    };
  },
}));

vi.mock('@ui/components/DashboardPanel', () => ({
  DashboardPanel: ({
    title,
    headerRight,
    children
  }: {
    title: string;
    headerRight?: ReactNode;
    children: ReactNode;
  }) => (
    <section>
      <div>
        <h2>{title}</h2>
        {headerRight}
      </div>
      <div>{children}</div>
    </section>
  )
}));

vi.mock('@ui/components/SecondaryButton', () => ({
  SecondaryButton: ({
    children,
    onClick,
    disabled
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}));

vi.mock('@ui/components/NumberInput', () => ({
  NumberInput: ({
    label,
    value,
    onChange,
    ariaLabel
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
  }) => (
    <label>
      <span>{label}</span>
      <input
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}));

vi.mock('@ui/components/SegmentedControl', () => ({
  SegmentedControl: ({
    options,
    value,
    onChange
  }: {
    options: Array<{ value: string; label: string }>;
    value: string;
    onChange: (value: 'threeColors' | 'gradient') => void;
  }) => (
    <div>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value as 'threeColors' | 'gradient')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}));

vi.mock('@ui/components/GlucoseDateRangePicker', () => ({
  GlucoseDateRangePicker: () => <button type="button">Custom</button>
}));

vi.mock('@ui/components/GlucoseStatRing', () => ({
  GlucoseStatRing: ({ label, percentage }: { label: string; percentage: number }) => (
    <div>{label}:{percentage}</div>
  )
}));

vi.mock('@ui/components/GlucoseAgpChart', () => ({
  GlucoseAgpChart: () => <div>AGP chart</div>
}));

vi.mock('@ui/components/GlucoseChart/GlucoseChart', () => ({
  GlucoseChart: ({
    data,
    onPointSelect,
    onCorrectionPreviewChange
  }: {
    data: Array<{ readingId?: string; valueMmolL: number; source: 'official' | 'share'; correctionReason?: string | null }>;
    onPointSelect?: (point: { readingId?: string; valueMmolL: number; source: 'official' | 'share'; correctionReason?: string | null }, additive: boolean) => void;
    onCorrectionPreviewChange?: (items: Array<{ readingId: string; valueMmolL: number }>) => void;
  }) => (
    <div>
      <div data-testid="chart-reading-ids">
        {data.map((point) => point.readingId ?? 'missing').join(',')}
      </div>
      {data.map((point, index) => (
        <div key={point.readingId ?? index}>
          <button type="button" onClick={() => onPointSelect?.(point, false)}>
            select-{point.readingId}
          </button>
          {point.readingId ? (
            <button
              type="button"
              onClick={() =>
                onCorrectionPreviewChange?.([
                  {
                    readingId: point.readingId!,
                    valueMmolL: Number((point.valueMmolL + 1.2).toFixed(1))
                  }
                ])
              }
            >
              preview-{point.readingId}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}));

function createHistoryResponse() {
  return {
    items: [
      {
        readingId: 'reading-1',
        timestamp: '2026-03-29T07:00:00.000Z',
        valueMmolL: 5.6,
        valueMgDl: 101,
        source: 'official' as const,
        trend: 'flat',
        originalValueMmolL: null,
        originalValueMgDl: null,
        isCorrected: false,
        correctionReason: null
      },
      {
        readingId: 'reading-2',
        timestamp: '2026-03-29T07:05:00.000Z',
        valueMmolL: 6.1,
        valueMgDl: 110,
        source: 'share' as const,
        trend: 'flat',
        originalValueMmolL: 7.2,
        originalValueMgDl: 130,
        isCorrected: true,
        correctionReason: 'Sensor compression low'
      }
    ],
    basalItems: [],
    eventItems: [],
    stepItems: [],
    latest: {
      id: 'latest-1',
      timestamp: '2026-03-29T07:05:00.000Z',
      valueMmolL: 6.1,
      valueMgDl: 110,
      source: 'share' as const,
      trend: 'flat',
      originalValueMmolL: 7.2,
      originalValueMgDl: 130,
      isCorrected: true,
      correctionReason: 'Sensor compression low'
    },
    meta: {
      from: '2026-03-26T07:05:00.000Z',
      to: '2026-03-29T07:05:00.000Z',
      officialCount: 1,
      shareCount: 1,
      mergedCount: 2,
      tandemBasalCount: 0,
      tandemEventCount: 0,
      healthStepCount: 0
    }
  };
}

function createTwoWeekHistoryResponse() {
  return {
    items: [
      {
        readingId: 'reading-old',
        timestamp: '2026-03-20T07:00:00.000Z',
        valueMmolL: 7.1,
        valueMgDl: 128,
        source: 'official' as const,
        trend: 'flat',
        originalValueMmolL: null,
        originalValueMgDl: null,
        isCorrected: false,
        correctionReason: null
      },
      {
        readingId: 'reading-recent',
        timestamp: '2026-03-28T07:00:00.000Z',
        valueMmolL: 5.6,
        valueMgDl: 101,
        source: 'official' as const,
        trend: 'flat',
        originalValueMmolL: null,
        originalValueMgDl: null,
        isCorrected: false,
        correctionReason: null
      },
      {
        readingId: 'reading-latest',
        timestamp: '2026-03-29T07:05:00.000Z',
        valueMmolL: 6.1,
        valueMgDl: 110,
        source: 'share' as const,
        trend: 'flat',
        originalValueMmolL: 7.2,
        originalValueMgDl: 130,
        isCorrected: true,
        correctionReason: 'Sensor compression low'
      }
    ],
    basalItems: [],
    eventItems: [],
    stepItems: [],
    latest: {
      id: 'latest-1',
      timestamp: '2026-03-29T07:05:00.000Z',
      valueMmolL: 6.1,
      valueMgDl: 110,
      source: 'share' as const,
      trend: 'flat',
      originalValueMmolL: 7.2,
      originalValueMgDl: 130,
      isCorrected: true,
      correctionReason: 'Sensor compression low'
    },
    meta: {
      from: '2026-03-15T07:05:00.000Z',
      to: '2026-03-29T07:05:00.000Z',
      officialCount: 2,
      shareCount: 1,
      mergedCount: 3,
      tandemBasalCount: 0,
      tandemEventCount: 0,
      healthStepCount: 0
    }
  };
}

describe('GlucoseAnalysisView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    swrCache.clear();
    useSWRMock.mockImplementation((key: string | null) => {
      if (!key) {
        return {
          data: undefined,
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: vi.fn()
        };
      }

      if (String(key).startsWith('/api/dashboard/glucose/updates')) {
        return {
          data: { latest: null, meta: { since: '', to: '', newCount: 0 } },
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: vi.fn()
        };
      }

      return {
        data: createHistoryResponse(),
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: historyMutateMock
      };
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ updated: 1, cleared: 0 })
      }))
    );

    document.documentElement.className = 'theme-dark';
    window.localStorage.clear();
  });

  test('renders from the initial snapshot while history revalidation is still empty', async () => {
    const initialSnapshot = createHistoryResponse();

    useSWRMock.mockImplementation((key: string | null) => {
      if (!key) {
        return {
          data: undefined,
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: vi.fn()
        };
      }

      if (String(key).startsWith('/api/dashboard/glucose/updates')) {
        return {
          data: { latest: null, meta: { since: '', to: '', newCount: 0 } },
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: vi.fn()
        };
      }

      return {
        data: undefined,
        error: undefined,
        isLoading: true,
        isValidating: false,
        mutate: vi.fn()
      };
    });

    render(<GlucoseAnalysisView isOwner={false} initialSnapshot={initialSnapshot} />);

    expect(await screen.findByRole('button', { name: 'select-reading-1' })).toBeInTheDocument();
    expect(screen.queryByText('Loading glucose data...')).not.toBeInTheDocument();
  });

  test('reuses a loaded superset range when switching back to 3 days', async () => {
    const initialSnapshot = createHistoryResponse();
    const twoWeekResponse = createTwoWeekHistoryResponse();

    useSWRMock.mockImplementation((key: string | null) => {
      if (!key) {
        return {
          data: undefined,
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: vi.fn()
        };
      }

      if (String(key).startsWith('/api/dashboard/glucose/updates')) {
        return {
          data: { latest: null, meta: { since: '', to: '', newCount: 0 } },
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: vi.fn()
        };
      }

      if (key === '/api/dashboard/glucose/history?range=14d') {
        return {
          data: twoWeekResponse,
          error: undefined,
          isLoading: false,
          isValidating: false,
          mutate: historyMutateMock
        };
      }

      if (key === '/api/dashboard/glucose/history?range=3d') {
        return {
          data: undefined,
          error: undefined,
          isLoading: true,
          isValidating: false,
          mutate: historyMutateMock
        };
      }

      return {
        data: createHistoryResponse(),
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: historyMutateMock
      };
    });

    render(<GlucoseAnalysisView isOwner={false} initialSnapshot={initialSnapshot} />);

    fireEvent.click(screen.getByRole('button', { name: '2 weeks' }));
    swrCache.set('/api/dashboard/glucose/history?range=14d', { data: twoWeekResponse });

    await waitFor(() => {
      expect(screen.getByTestId('chart-reading-ids')).toHaveTextContent(
        'reading-old,reading-recent,reading-latest'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '3 days' }));

    await waitFor(() => {
      expect(screen.getByTestId('chart-reading-ids')).toHaveTextContent(
        'reading-recent,reading-latest'
      );
    });

    const historyKeys = useSWRMock.mock.calls
      .map(([key]) => key)
      .filter((key): key is string => typeof key === 'string' && key.startsWith('/api/dashboard/glucose/history'));

    expect(historyKeys.at(-1)).toBe('/api/dashboard/glucose/history?range=14d');
    expect(
      historyKeys.filter((key) => key === '/api/dashboard/glucose/history?range=3d')
    ).toHaveLength(1);
  });

  test('lets visitors preview corrections but not apply them', async () => {
    render(<GlucoseAnalysisView isOwner={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'select-reading-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'preview-reading-1' }));

    expect(await screen.findByText('Active readings')).toBeInTheDocument();
    expect(screen.getByText('1 reading is being adjusted.')).toBeInTheDocument();
    expect(screen.getByText('Preview is available to everyone. Admin sign in is required to apply corrections.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply preview' })).toBeDisabled();
  });

  test('submits preview corrections with a required reason for owners', async () => {
    const fetchMock = vi.mocked(fetch);

    render(<GlucoseAnalysisView isOwner />);

    fireEvent.click(screen.getByRole('button', { name: 'select-reading-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'preview-reading-1' }));

    const reasonInput = await screen.findByLabelText('Reason for glucose correction');
    fireEvent.change(reasonInput, { target: { value: 'Sensor compression low' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply preview' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/dashboard/glucose/corrections',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            items: [
              {
                source: 'official',
                readingId: 'reading-1',
                valueMmolL: 6.8,
                reason: 'Sensor compression low'
              }
            ]
          })
        })
      );
    });

    expect(historyMutateMock).toHaveBeenCalled();
  });

  test('lets owners remove an existing correction and restore the original reading', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ updated: 0, cleared: 1 })
    } as Response);

    render(<GlucoseAnalysisView isOwner />);

    fireEvent.click(screen.getByRole('button', { name: 'select-reading-2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove correction' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/dashboard/glucose/corrections',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            items: [
              {
                source: 'share',
                readingId: 'reading-2',
                valueMmolL: null,
                reason: null
              }
            ]
          })
        })
      );
    });

    expect(historyMutateMock).toHaveBeenCalled();
  });

  test('keeps building one correction session when more readings are clicked', async () => {
    render(<GlucoseAnalysisView isOwner />);

    fireEvent.click(screen.getByRole('button', { name: 'select-reading-1' }));
    expect(await screen.findByText('1 reading selected. Click more readings to add them to this correction.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'select-reading-2' }));
    expect(screen.getByText('2 readings selected. Click more readings to keep building this correction.')).toBeInTheDocument();
  });
});
