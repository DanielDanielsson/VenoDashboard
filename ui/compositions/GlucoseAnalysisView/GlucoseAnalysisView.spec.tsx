// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { formatWorkoutTimeRange } from '@/lib/glucose/workout-display';
import { getDashboardDefinition } from '@/lib/dashboard/registry';
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
    colorMode,
    yMax,
    workoutData = [],
    noteData = [],
    onPointSelect,
    onCorrectionPreviewChange,
    onWorkoutAddRequest,
    onNoteAddRequest,
    onNoteSelect,
    onWorkoutSelect
  }: {
    data: Array<{ readingId?: string; valueMmolL: number; source: 'official' | 'share'; correctionReason?: string | null }>;
    colorMode?: string;
    yMax?: number;
    workoutData?: Array<{
      id: string;
      displayName: string | null;
      workoutType: string;
      sourceSystem: string;
      startAt: string;
      endAt: string;
    }>;
    noteData?: Array<{ id: string; text: string }>;
    onPointSelect?: (point: { readingId?: string; valueMmolL: number; source: 'official' | 'share'; correctionReason?: string | null }, additive: boolean) => void;
    onCorrectionPreviewChange?: (items: Array<{ readingId: string; valueMmolL: number }>) => void;
    onWorkoutAddRequest?: (hoveredAt: string | null) => void;
    onNoteAddRequest?: (hoveredAt: string | null) => void;
    onNoteSelect?: (note: { id: string; text: string }) => void;
    onWorkoutSelect?: (workout: {
      id: string;
      displayName: string | null;
      workoutType: string;
      sourceSystem: string;
      startAt: string;
      endAt: string;
    }) => void;
  }) => (
    <div>
      <div data-testid="chart-settings">
        {colorMode ?? 'missing'}:{String(yMax ?? 'missing')}
      </div>
      <div data-testid="chart-reading-ids">
        {data.map((point) => point.readingId ?? 'missing').join(',')}
      </div>
      <div data-testid="chart-workout-ids">
        {workoutData.map((workout) => workout.id).join(',')}
      </div>
      <div data-testid="chart-note-ids">
        {noteData.map((note) => note.id).join(',')}
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
      <button type="button" onClick={() => onNoteAddRequest?.('2026-03-29T07:00:00.000Z')}>
        add-note
      </button>
      <button type="button" onClick={() => onWorkoutAddRequest?.('2026-03-29T07:00:00.000Z')}>
        add-workout
      </button>
      {noteData.map((note) => (
        <button key={note.id} type="button" onClick={() => onNoteSelect?.(note)}>
          note-{note.id}
        </button>
      ))}
      {workoutData.map((workout) => (
        <button key={workout.id} type="button" onClick={() => onWorkoutSelect?.(workout)}>
          workout-{workout.id}
        </button>
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
    workoutItems: [],
    noteItems: [],
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

function createHistoryResponseWithNote() {
  return {
    ...createHistoryResponse(),
    noteItems: [
      {
        id: 'note-1',
        text: 'Workout affected glucose',
        startAt: '2026-03-29T06:00:00.000Z',
        endAt: '2026-03-29T07:00:00.000Z',
        timezone: 'UTC',
        allDay: false,
        authorType: 'user' as const,
        source: 'dashboard',
        createdAt: '2026-03-29T06:00:00.000Z',
        updatedAt: '2026-03-29T06:00:00.000Z',
        createdBy: 'owner@example.com',
        updatedBy: 'owner@example.com'
      }
    ]
  };
}

function createHistoryResponseWithWorkout() {
  return {
    ...createHistoryResponse(),
    workoutItems: [
      {
        id: 'workout-1',
        startAt: '2026-03-29T06:00:00.000Z',
        endAt: '2026-03-29T07:00:00.000Z',
        workoutType: 'run',
        rawWorkoutType: 'running',
        displayName: 'Morning run',
        sourceSystem: 'apple_health',
        sourceId: 'apple-workout-1',
        activeEnergyKilocalories: 483.4,
        distanceMeters: 5120.7
      }
    ]
  };
}

function createHistoryResponseWithManualWorkout() {
  return {
    ...createHistoryResponse(),
    workoutItems: [
      {
        id: 'workout-manual-1',
        startAt: '2026-03-29T07:00:00.000Z',
        endAt: '2026-03-29T08:00:00.000Z',
        workoutType: 'strength',
        rawWorkoutType: null,
        displayName: 'Gym',
        sourceSystem: 'manual',
        sourceId: 'manual-workout-1'
      }
    ]
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

function createOwnerProfileResponse() {
  return {
    profile: {
      timezone: 'UTC'
    }
  };
}

describe('GlucoseAnalysisView', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

      if (key === '/api/dashboard/settings/profile') {
        return {
          data: createOwnerProfileResponse(),
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

      if (key === '/api/dashboard/settings/profile') {
        return {
          data: createOwnerProfileResponse(),
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

  test('refreshes the dashboard history query from the refresh picker', () => {
    render(<GlucoseAnalysisView isOwner />);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));

    expect(historyMutateMock).toHaveBeenCalled();
  });

  test('uses saved dashboard auto refresh settings to refresh history', async () => {
    const dashboardDefinition = structuredClone(getDashboardDefinition('statistics'));
    dashboardDefinition.spec.timeSettings.autoRefresh = '5s';
    vi.useFakeTimers();

    render(<GlucoseAnalysisView isOwner dashboardDefinition={dashboardDefinition} />);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(historyMutateMock).toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole('button', { name: /Time range selected/i }));
    fireEvent.click(screen.getByRole('button', { name: '2 weeks' }));
    swrCache.set('/api/dashboard/glucose/history?range=14d', { data: twoWeekResponse });

    await waitFor(() => {
      expect(screen.getByTestId('chart-reading-ids')).toHaveTextContent(
        'reading-old,reading-recent,reading-latest'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /Time range selected/i }));
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

  test('lets public visitors edit glucose timeline settings locally and shows disabled save', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    render(<GlucoseAnalysisView isOwner={false} />);

    expect(screen.getByTestId('chart-settings')).toHaveTextContent('threeColors:25');

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Glucose Timeline' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    const drawer = screen.getByRole('complementary', { name: 'Panel settings for Glucose Timeline' });

    expect(within(drawer).getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(within(drawer).getByText('Admin sign in is required to save dashboard settings.')).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole('button', { name: 'Gradient' }));
    fireEvent.change(within(drawer).getByLabelText('Chart top value in mmol/L'), {
      target: { value: '18' }
    });

    expect(screen.getByTestId('chart-settings')).toHaveTextContent('gradient:18');
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  test('applies persisted glucose timeline settings from the dashboard definition', () => {
    const dashboardDefinition = structuredClone(getDashboardDefinition('statistics'));
    dashboardDefinition.spec.elements['panel-glucose-timeline'].spec.vizConfig.spec.options = {
      colorMode: 'gradient',
      yAxisMax: 18,
    };

    render(<GlucoseAnalysisView isOwner={false} dashboardDefinition={dashboardDefinition} />);

    expect(screen.getByTestId('chart-settings')).toHaveTextContent('gradient:18');
  });

  test('resets public glucose timeline settings after remount', async () => {
    const { unmount } = render(<GlucoseAnalysisView isOwner={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Glucose Timeline' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    const drawer = screen.getByRole('complementary', { name: 'Panel settings for Glucose Timeline' });

    fireEvent.click(within(drawer).getByRole('button', { name: 'Gradient' }));
    fireEvent.change(within(drawer).getByLabelText('Chart top value in mmol/L'), {
      target: { value: '18' }
    });

    expect(screen.getByTestId('chart-settings')).toHaveTextContent('gradient:18');

    unmount();
    render(<GlucoseAnalysisView isOwner={false} />);

    expect(screen.getByTestId('chart-settings')).toHaveTextContent('threeColors:25');
  });

  test('does not render the old standalone statistics settings panel', () => {
    render(<GlucoseAnalysisView isOwner={false} />);

    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Time range selected: Last 3 days' })).toBeInTheDocument();
  });

  test('switches the time in range panel layout from panel settings', () => {
    render(<GlucoseAnalysisView isOwner={false} />);

    expect(screen.queryByRole('button', { name: '24d' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Time in Range' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open panel actions for Time in Range' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    const drawer = screen.getByRole('complementary', { name: 'Panel settings for Time in Range' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Overview' }));

    expect(screen.queryByRole('button', { name: '24d' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Time In Range' })).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole('button', { name: 'Statistics' }));

    expect(screen.queryByRole('button', { name: '24d' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Time in Range' })).toBeInTheDocument();
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

  test('shows note length validation only after save is attempted', async () => {
    const fetchMock = vi.mocked(fetch);

    render(<GlucoseAnalysisView isOwner />);

    fireEvent.click(screen.getByRole('button', { name: 'add-note' }));

    expect(screen.queryByText('Notes must contain at least 3 non whitespace characters.')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Note'), {
      target: { value: 'hi' }
    });

    expect(screen.queryByText('Notes must contain at least 3 non whitespace characters.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

    expect(await screen.findByText('Notes must contain at least 3 non whitespace characters.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/dashboard/glucose/notes',
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('focuses the note textarea when creating a new note', async () => {
    render(<GlucoseAnalysisView isOwner />);

    fireEvent.click(screen.getByRole('button', { name: 'add-note' }));

    expect(await screen.findByRole('dialog', { name: 'New timeline note' })).toBeInTheDocument();
    expect(screen.getByTestId('note-editor-overlay')).toBeInTheDocument();

    const noteField = await screen.findByLabelText('Note');

    await waitFor(() => {
      expect(document.activeElement).toBe(noteField);
    });
  });

  test('hides all day and time controls for multi day notes', async () => {
    render(<GlucoseAnalysisView isOwner />);

    fireEvent.click(screen.getByRole('button', { name: 'add-note' }));
    fireEvent.change(await screen.findByLabelText('End date'), {
      target: { value: '2026-03-30' }
    });

    await waitFor(() => {
      expect(screen.queryByText('All day')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Start time')).not.toBeInTheDocument();
    expect(screen.queryByText('End time')).not.toBeInTheDocument();
  });

  test('shows only created by for a note that has not been edited', async () => {
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

      if (key === '/api/dashboard/settings/profile') {
        return {
          data: createOwnerProfileResponse(),
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
        mutate: historyMutateMock
      };
    });

    render(<GlucoseAnalysisView isOwner initialSnapshot={createHistoryResponseWithNote()} />);

    fireEvent.click(screen.getByRole('button', { name: 'note-note-1' }));

    expect(await screen.findByText('Created by owner@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Updated by owner@example.com')).not.toBeInTheDocument();
  });

  test('lets owners edit an existing note', async () => {
    const fetchMock = vi.mocked(fetch);
    const initialSnapshot = createHistoryResponseWithNote();

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

      if (key === '/api/dashboard/settings/profile') {
        return {
          data: createOwnerProfileResponse(),
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
        mutate: historyMutateMock
      };
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        note: {
          ...initialSnapshot.noteItems[0],
          text: 'Edited note text',
          updatedAt: '2026-03-29T08:00:00.000Z',
          updatedBy: 'owner@example.com'
        }
      })
    } as Response);

    render(<GlucoseAnalysisView isOwner initialSnapshot={initialSnapshot} />);

    fireEvent.click(screen.getByRole('button', { name: 'note-note-1' }));
    fireEvent.change(await screen.findByLabelText('Note'), {
      target: { value: 'Edited note text' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/dashboard/glucose/notes/note-1',
        expect.objectContaining({
          method: 'PUT'
        })
      );
    });
  });

  test('removes a deleted note from the chart immediately while the initial snapshot is still the source', async () => {
    const fetchMock = vi.mocked(fetch);
    const initialSnapshot = createHistoryResponseWithNote();

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

      if (key === '/api/dashboard/settings/profile') {
        return {
          data: createOwnerProfileResponse(),
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
        mutate: historyMutateMock
      };
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    } as Response);

    render(<GlucoseAnalysisView isOwner initialSnapshot={initialSnapshot} />);

    expect(screen.getByTestId('chart-note-ids')).toHaveTextContent('note-1');

    fireEvent.click(screen.getByRole('button', { name: 'note-note-1' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => {
      expect(screen.getByTestId('chart-note-ids')).toHaveTextContent('');
    });
    expect(historyMutateMock).toHaveBeenCalled();
  });

  test('passes workout items through to the chart from the initial snapshot', () => {
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
        mutate: historyMutateMock
      };
    });

    render(<GlucoseAnalysisView isOwner={false} initialSnapshot={createHistoryResponseWithWorkout()} />);

    expect(screen.getByTestId('chart-workout-ids')).toHaveTextContent('workout-1');
  });

  test('opens a read only workout dialog when a workout is selected', async () => {
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
        mutate: historyMutateMock
      };
    });

    render(<GlucoseAnalysisView isOwner={false} initialSnapshot={createHistoryResponseWithWorkout()} />);

    fireEvent.click(screen.getByRole('button', { name: 'workout-workout-1' }));

    expect(await screen.findByRole('dialog', { name: 'Workout details' })).toBeInTheDocument();
    expect(screen.getByText('Morning run')).toBeInTheDocument();
    expect(screen.getByText('Apple Health')).toBeInTheDocument();
    expect(screen.getByText('483 kcal · 5.1 km')).toBeInTheDocument();
    expect(screen.getByText(formatWorkoutTimeRange('2026-03-29T06:00:00.000Z', '2026-03-29T07:00:00.000Z'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  test('lets owners create a manual workout from the chart', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        workout: {
          id: 'workout-manual-1',
          startAt: '2026-03-29T07:00:00.000Z',
          endAt: '2026-03-29T08:00:00.000Z',
          workoutType: 'strength',
          rawWorkoutType: null,
          displayName: 'Gym',
          sourceSystem: 'manual',
          sourceId: 'manual-workout-1'
        }
      })
    } as Response);

    render(<GlucoseAnalysisView isOwner initialSnapshot={createHistoryResponse()} />);

    fireEvent.click(screen.getByRole('button', { name: 'add-workout' }));
    expect(await screen.findByRole('dialog', { name: 'New workout' })).toBeInTheDocument();
    expect(screen.getByLabelText('Start time')).toHaveValue('07:00');
    expect(screen.getByLabelText('End time')).toHaveValue('08:00');

    fireEvent.change(screen.getByLabelText('Workout type'), {
      target: { value: 'strength' }
    });
    fireEvent.change(screen.getByLabelText('Display label'), {
      target: { value: 'Gym' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/dashboard/glucose/workouts',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            startAt: '2026-03-29T07:00:00.000Z',
            endAt: '2026-03-29T08:00:00.000Z',
            workoutType: 'strength',
            displayName: 'Gym'
          })
        })
      );
    });
  });

  test('lets owners edit and delete manual workouts', async () => {
    const fetchMock = vi.mocked(fetch);
    const initialSnapshot = createHistoryResponseWithManualWorkout();

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

      if (key === '/api/dashboard/settings/profile') {
        return {
          data: createOwnerProfileResponse(),
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
        mutate: historyMutateMock
      };
    });

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workout: {
            ...initialSnapshot.workoutItems[0],
            displayName: 'Leg day'
          }
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deleted: true, workoutId: 'workout-manual-1' })
      } as Response);

    render(<GlucoseAnalysisView isOwner initialSnapshot={initialSnapshot} />);

    fireEvent.click(screen.getByRole('button', { name: 'workout-workout-manual-1' }));
    expect(await screen.findByRole('dialog', { name: 'Workout' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Display label'), {
      target: { value: 'Leg day' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/dashboard/glucose/workouts/workout-manual-1',
        expect.objectContaining({
          method: 'PUT'
        })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete workout' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/dashboard/glucose/workouts/workout-manual-1',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  test('lets owners save local overrides for imported workouts', async () => {
    const fetchMock = vi.mocked(fetch);
    const initialSnapshot = createHistoryResponseWithWorkout();

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

      if (key === '/api/dashboard/settings/profile') {
        return {
          data: createOwnerProfileResponse(),
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
        mutate: historyMutateMock
      };
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        workout: {
          ...initialSnapshot.workoutItems[0],
          startAt: '2026-03-29T07:00:00.000Z',
          endAt: '2026-03-29T08:00:00.000Z',
          workoutType: 'strength',
          displayName: 'Gym override'
        }
      })
    } as Response);

    render(<GlucoseAnalysisView isOwner initialSnapshot={initialSnapshot} />);

    fireEvent.click(screen.getByRole('button', { name: 'workout-workout-1' }));
    expect(await screen.findByRole('dialog', { name: 'Workout' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Start time'), {
      target: { value: '09:00' }
    });
    fireEvent.change(screen.getByLabelText('End time'), {
      target: { value: '10:00' }
    });
    fireEvent.change(screen.getByLabelText('Workout type'), {
      target: { value: 'strength' }
    });
    fireEvent.change(screen.getByLabelText('Display label'), {
      target: { value: 'Gym override' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save workout' }));

    await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/dashboard/glucose/workouts/workout-1',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({
              startAt: '2026-03-29T09:00:00.000Z',
              endAt: '2026-03-29T10:00:00.000Z',
              workoutType: 'strength',
              displayName: 'Gym override'
            })
          })
      );
    });

    expect(await screen.findByRole('dialog', { name: 'Workout' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete workout' })).not.toBeInTheDocument();
  });
});
