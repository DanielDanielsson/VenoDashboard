// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionMapSnapshot } from '@/lib/dashboard/connection-map';
import { ConnectionsMapPanel } from './ConnectionsMapPanel';

const INITIAL_SNAPSHOT: ConnectionMapSnapshot = {
  updatedAt: '2026-03-26T09:00:00.000Z',
  nodes: [
    {
      id: 'official',
      label: 'Dexcom official',
      detail: 'Official glucose',
      icon: 'glucose',
      state: 'live',
      latestActivityAt: '2026-03-26T08:56:00.000Z',
      ageLabel: '4m ago',
    },
    {
      id: 'veno-api',
      label: 'Veno API',
      detail: 'Unified data layer',
      icon: 'server',
      state: 'live',
      latestActivityAt: null,
      ageLabel: null,
    },
    {
      id: 'veno-dashboard',
      label: 'Veno Dashboard',
      detail: 'Live overview',
      icon: 'veno-logo',
      state: 'live',
      latestActivityAt: null,
      ageLabel: 'Rendering now',
    },
  ],
  edges: [
    { id: 'official-api', from: 'official', to: 'veno-api', state: 'live', direction: 'one-way' },
    { id: 'api-dashboard', from: 'veno-api', to: 'veno-dashboard', state: 'live', direction: 'one-way' },
    { id: 'dashboard-api', from: 'veno-dashboard', to: 'veno-api', state: 'live', direction: 'one-way' },
  ],
};

describe('ConnectionsMapPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the initial graph and polls for refreshes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(INITIAL_SNAPSHOT), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<ConnectionsMapPanel initialSnapshot={INITIAL_SNAPSHOT} />);

    expect(screen.getByText('Dexcom official')).toBeInTheDocument();
    expect(screen.getByText('Veno API')).toBeInTheDocument();
    expect(screen.getByText('Veno Dashboard')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/dashboard/connections', { cache: 'no-store' });
  });
});
